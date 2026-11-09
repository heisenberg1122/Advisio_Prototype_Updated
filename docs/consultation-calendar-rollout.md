# Consultation Calendar rollout

## Findings and implementation

The previous API attempted to create Calendar events for unapproved student requests, supplied only the requesting account as an attendee, and discarded the Google event ID. It treated asynchronous conference creation as a failure, used a fresh Google request identity on every attempt, and could report a faculty consultation as scheduled without a usable room. Approval only changed the Advisio status. There were no synchronized edits, participant changes, cancellations, or consultation notifications.

Project and college scope could expose private links through calendar and workspace queries. Joining could add an uninvited user to the participant list. The dean workspace hid links even from invitees. The generic Calendar composer also allowed new entries labelled as consultations without creating a consultation record. Scheduled joins wrote to the same group-wide instant meeting slot, whose URL came from a fixed room, a generic Meet URL, or browser storage. The Gmail prompt accepted typed addresses as if they authenticated with Google.

The API now stores each scheduled or instant meeting as its own PostgreSQL consultation. Student requests go to the selected assigned adviser, and a request gets a conference after approval. Authorized faculty select active group researchers and eligible faculty in the project's college. The invited participants share one saved room, and Google Calendar receives the same roster. Advisio notifications are saved with the lifecycle change. The role views and calendar refresh every 15 seconds while open.

Calendar creation reserves a stable event ID. It requests a Meet conference using `conferenceDataVersion=1` and polls with bounded backoff. The service adds attendees with `sendUpdates=all` after the room is ready. Rescheduling and roster edits update the existing event. Pending Calendar edits and cancellations survive a process restart and can be retried by the API worker. Advisio keeps the previously confirmed schedule and roster until a Calendar edit succeeds. A cancelled consultation loses its Advisio Join action immediately while a failed Calendar deletion stays queued.

Advisio authorizes consultation links, notes, and join actions using the invitation and the active college. Deans retain same-college schedule and status oversight, and receive the link only for their own invitations. Manual entries accept existing Google Meet room URLs and are recorded as manual. The migration preserves old rows and marks their origin as legacy. The former shared room and generic Meet creation URL are rejected. The first edit to a legacy meeting without a linked Calendar event creates a new event and verified room.

## Google Cloud and Render configuration

1. In Google Cloud Console, select or create a staging-only project. Enable **Google Calendar API** under **APIs & Services → Library**. Choose a dedicated organizer whose primary calendar supports Google Meet. A personal Gmail account can host Google Meet and requires an External OAuth app. An Internal OAuth app requires the organizer to belong to the project's Google Workspace or Cloud Identity organization. Free personal accounts have a 60-minute limit for meetings with three or more participants, and only the organizer can admit uninvited guests. Keep the organizer separate from invited test users and use a separate organizer and OAuth client for production.
2. In **Google Auth Platform**, complete **Branding**, **Audience**, and **Data Access**. Choose **Internal** if the Cloud project and organizer belong to the same Google Workspace organization. Otherwise use **External → Testing** for staging and add the organizer as a test user. Add `https://www.googleapis.com/auth/calendar.events.owned` for the organizer's own calendar. Use `https://www.googleapis.com/auth/calendar.events` if using a calendar owned by someone else that the organizer can edit. An External app in Testing generally issues seven-day refresh tokens for Calendar scopes. Complete the applicable Workspace and Google publishing requirements before production.
3. Under **Clients**, create a **Web application** client for the staging integration. For Google's OAuth 2.0 Playground, add `https://developers.google.com/oauthplayground` as the exact authorized redirect URI. In the Playground, open the settings, select **Server-side**, **Offline**, **Consent Screen**, and **Use your own OAuth credentials**. Use the Google endpoints and enter the staging client details directly in Google's Playground. Under Step 1, authorize the exact Calendar scope while signed into the dedicated organizer account. Under Step 2, exchange the authorization code and transfer the **refresh token** directly to the approved secret manager or Render Environment field. The integration refreshes access tokens itself. Keep the client secret, refresh token, and authorization code out of chat, shell history, screenshots, repository files, and frontend builds. Keep the Playground's option to include OAuth credentials and tokens in a generated link off.
4. When staging is isolated and configuration changes are approved, add these keys under **Environment** on `advisio-api-staging`. Use **Save only** while preparing the release. Keep the service suspended until the staging database has been verified and the deployment is approved.

   | Render staging key | Value |
   | --- | --- |
   | `GOOGLE_CALENDAR_CLIENT_ID` | Dedicated Calendar OAuth client ID |
   | `GOOGLE_CALENDAR_CLIENT_SECRET` | Dedicated Calendar OAuth client secret |
   | `GOOGLE_CALENDAR_REFRESH_TOKEN` | Offline refresh token granted by the organizer |
   | `GOOGLE_CALENDAR_ID` | Set `primary` for the organizer's main calendar. The API defaults to `primary` if omitted |

   The organizer account and calendar must stay stable for existing event IDs to remain usable. The organizer authorizes this integration via user OAuth. The existing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, and `GOOGLE_REDIRECT_URI` used by Drive are separate. Advisio sign-in continues using its existing Google Sign-In settings and frontend JavaScript origins.

5. Set staging `DATABASE_URL` and `DIRECT_URL` to the new, isolated database. Set staging `WEB_URL` and `CORS_ORIGIN` to the approved staging frontend origin. Build staging web with `VITE_API_URL=https://advisio-api-staging.onrender.com`. Keep `NOTIFICATION_EMAILS_ENABLED=false` for staging, which leaves Google Calendar's test invitations available through the dedicated organizer. Use separate staging session and storage credentials. Test accounts can use staging passwords. If staging also uses Google Sign-In, configure a separate Sign-In client and its exact staging frontend origin, with self-signup and demo provisioning disabled.
6. Production keeps `WEB_URL=https://advisio-ua.com` and allows that exact origin in `CORS_ORIGIN`. The Namecheap workflow sets `VITE_API_URL=https://advisio-prototype-updated.onrender.com`. The app sends its session token in the authorization header. Calendar OAuth uses the setup tool's callback and leaves the existing sign-in and Drive callbacks in place.
7. Before saving the production variables, use the organizer's refresh token to obtain a new access token and check that the grant includes the requested Calendar write scope. Use it for `GET https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=kind` and record only the result status. This checks the refresh grant and calendar access without retrieving event details or creating meetings. Save the four keys on `Advisio_Prototype_Updated` with **Save only** once validated. Verify Meet conference creation and invitation delivery separately with approved test accounts.

References. [Google OAuth consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent), [Calendar event creation](https://developers.google.com/workspace/calendar/api/guides/create-events), [Calendar OAuth scopes](https://developers.google.com/workspace/calendar/api/auth), [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/), [Google Meet guest admission](https://support.google.com/meet/answer/9302870), [Google Meet limits](https://support.google.com/meet/answer/7317473), [Render environment variables](https://render.com/docs/configure-environment-variables).

## Deployment review on November 9, 2026

- The production API's runtime and Prisma migration targets both identify **Render PostgreSQL**, host `dpg-dbb3mkbl550s73c8k2b0-a`, database `advisio_staging`. Both staging targets identify the same database. The Render resource `advisio-staging-db` serves production. Its Free plan has no Render backup or point-in-time recovery. Render lists its expiration as November 18, 2026 at 11:46 PM Manila time. A read-only custom-format backup was saved with an encrypted restore receipt outside the repository and successfully restored to isolated PostgreSQL 16.15.
- The staging API is suspended and returns HTTP 503. Its configured Git branch is `refactor/cohort-driven-research-flow`. There is no Advisio staging frontend in the inspected Render workspace. The local staging frontend build targets only the staging API. Isolate the staging database and confirm staging-only Calendar credentials before enabling it.
- The public production SPA targets the intended Render API. Its consultation POST preflight accepted `Authorization`, `Content-Type`, and `X-Advisio-Panel` from `https://advisio-ua.com`. An unapproved origin received HTTP 403. These checks cover deployed revision `a72355b8dd2941a9227fde7aa20201237f7db308`.
- Four successful production migrations were missing from the local checkout. Their original SQL is now restored locally and matches the production ledger checksums byte for byte.
  - `20261025010000_milestone_prerequisites` from `91b324b`
  - `20261027000300_research_cohorts` from `ecb8fbd`
  - `20261027000400_workflow_version_index` from `80170ec`
  - `20261027000500_provisional_research_title` from `e46433f`
- The forward migration `20261108105000_restore_workflow_version_uniqueness` adds the unique index and then removes the redundant nonunique index in one transaction. A synthetic rehearsal verified that a duplicate aborts the transaction with both rows and the old index intact. The production backup rehearsal confirmed the repaired index and preserved workflow rows. The approved index-only migration was applied and verified on live production before the consultation release. All 94 live migration checksums matched and the workflow row fingerprints were identical before and after.
- The production organizer authorized a dedicated client in Google Cloud project `liquid-engine-511802-s1`. A token refresh and a read-only request to the organizer’s primary Calendar succeeded. The four Calendar variables were saved on the production Render service with **Save only**. Their runtime use starts with the next deployment. Google generated a Meet link for one approved private event with no attendees. The event was deleted successfully. Invitation delivery and the shared link across Advisio roles still require acceptance testing.
- The consultation migration is transactional and uses a five-second lock timeout and a five-minute statement timeout. The synthetic rehearsal forced a lock timeout with no partial DDL. After the appearance migration reached production, a refreshed encrypted backup was restored to PostgreSQL 16.15. All 93 source checksums matched. Both candidate migrations applied, all 95 resulting migration checksums matched, and fingerprints confirmed that the original user, workflow, consultation, participant, and note records were preserved.
- Before sending reschedule or roster updates, the service checks that the organizer event still has the Meet URL stored in Advisio. It also restores private event visibility and disables guest forwarding on sync. A room changed directly on Google Calendar requires operator intervention before the edit can complete.

## Staging isolation and live acceptance

1. Keep the existing Render staging API suspended. Create or identify a new database dedicated to staging in the staging environment. Use only synthetic Advisio data. Verify that staging runtime and Prisma migration URLs both identify the new database and differ from the production host/database pair. Keep production connection and secret settings unchanged.
2. Identify the non-Vercel staging frontend origin and keep its publish root separate from production. Prepare its build with the staging API URL and verify the API's CORS response. Stage the dedicated Calendar configuration using the four keys above. Once approved, deploy the exact reviewed API and frontend candidate through a staging-only source revision. Confirm the staging health revision and database identity before signing in.
3. Use separate Google addresses and matching active synthetic Advisio accounts for the roles below. The one address already supplied is an invitee and still needs a role assignment. The dedicated organizer remains separate so the test measures invitation delivery to each Advisio participant.

   | Account | Required setup |
   | --- | --- |
   | Google organizer | Dedicated Workspace user with Calendar and Meet enabled, with the staging OAuth grant |
   | Student | Researcher and active leader or member of the synthetic project |
   | Adviser | Adviser in the same college, assigned to the synthetic project |
   | Panelist | Active panelist in the same college |
   | Dean | Active dean in the same college |
   | Other faculty | Active research coordinator or professor in the same college |
   | Negative control | Separate uninvited staging account to confirm consultation details and join links stay private |

4. After live invitation approval, submit a student request and approve it as the adviser. Check both inboxes, both Advisio views, and both Google Calendars for the same URL. Schedule a second meeting with the adviser, student, panelist, dean, and coordinator. Compare each user's Advisio link with the organizer event, verify receipt of the invitation, and check Meet admission. Refresh and sign in again from separate browser profiles. Test rescheduling on the same event, removing one recipient, cancelling, and creating two instant meetings. Record event identity, URL equality, delivery, calendar updates, and access results without capturing credentials.

## Production release and recovery gates

1. Record a verified recovery point before production changes. Use provider recovery if it is available on the approved plan. Otherwise, have the database owner make a timestamped custom-format PostgreSQL backup into approved encrypted storage and verify a restore to a restricted, separate PostgreSQL 16 database. Keep roles and grants needed for a faithful restore. Use only synthetic records in staging for live acceptance tests.
2. On that isolated restore, compare the Prisma ledger and relevant schema with the approved release. Check workflow versions for duplicates and rehearse both the workflow uniqueness correction and the consultation migration. Record their duration and lock behavior, verify the valid unique index and preserved consultation rows, and smoke-test the current and new API. Keep a matching schema-aware rollback API and the previous Namecheap artifact available.
3. Obtain explicit production approval after the live staging checks pass. Coordinate the production change window, confirm current backup evidence, configure the separate production Calendar organizer and the same four variable names, and record the prior frontend and API revisions. A push to `main` can deploy the Render API automatically, so treat it as the production release action. Pause consultation writes during the API/frontend transition through the approved maintenance procedure.
4. Release the exact reviewed commit through the existing Render Docker service and Namecheap workflow. Render runs `prisma migrate deploy` during startup. Check the migration output, the exact commit's GitHub Actions results, Render health and revision, and Namecheap publication separately. After deployment, verify browser requests from the official site and run authenticated smoke checks with approved test accounts before reopening consultation writes.
5. If rollback is needed, pause consultation writes and record queued Calendar changes. Preserve the additive schema and recover application compatibility with the prepared API and paired frontend. The old API may reject newer enum values or expose private links. Reconcile external Calendar events that were updated during the release. For database recovery, restore the verified point into a new restricted database, check it, reconcile subsequent legitimate writes, and approve the cutover before pointing services to it.

References. [Render database recovery](https://render.com/docs/postgresql-backups), [Prisma migration status and resolution](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-status).

## Verification boundaries

Local verification includes Prisma validation, monorepo type checking and builds, lint, the API and web suites, and the database integration suite on disposable PostgreSQL. The staging-targeted web bundle built locally and contained the staging API origin alone. The Render API Dockerfile also built locally. The production dependency audit reported three high-severity and six moderate findings from the existing lockfile. The high-severity package entries were `body-parser`, `multer`, and `zod`. Review these before release.

The public site returned HTTP 200. Render returned HTTP 204 for the production origin's CORS preflight and reported a healthy database on revision `a72355b8dd2941a9227fde7aa20201237f7db308`. These read-only checks covered the existing deployment.

Google API responses in automated tests are mocked. The approved organizer-only test verified conference generation directly against Google Calendar. Recipient inbox delivery, Calendar visibility, Meet admission, and already-copied links depend on Google settings and need an authorized live test. Organizer edits and RSVP changes made directly in Google Calendar stay in Google Calendar. Ending an Advisio session closes its Join action while the Google Meet call can continue.

When Google remains pending after the bounded creation checks, the organizer can select **Retry Google Calendar** to check the same event. An administrator should use the consultation cancellation action before deleting a project with linked events. Direct database or project deletion can bypass Calendar cleanup.

## Changed files

**Database and configuration**

- `.env.production.example`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20261108110000_consultation_calendar/migration.sql`

**API**

- `apps/api/src/config/env.ts`
- `apps/api/src/index.ts`
- `apps/api/src/routes/calendar.routes.ts`
- `apps/api/src/routes/consultation.routes.ts`
- `apps/api/src/routes/research.routes.ts`
- `apps/api/src/services/consultation-lifecycle.service.ts`
- `apps/api/src/services/consultation.service.ts`
- `apps/api/src/services/google-calendar.service.ts`

**Web**

- `apps/web/src/app/adviser/dashboard/page.tsx`
- `apps/web/src/app/adviser/advisees/[researchId]/page.tsx`
- `apps/web/src/app/student/consultations/page.tsx`
- `apps/web/src/app/student/dashboard/page.tsx`
- `apps/web/src/components/adviser/AdviserConsultationsWorkspace.tsx`
- `apps/web/src/components/adviser/consultations-workspace.css`
- `apps/web/src/components/calendar/UniversalCalendar.tsx`
- `apps/web/src/components/consultations/ConsultationActions.tsx`
- `apps/web/src/components/consultations/ConsultationBooking.tsx`
- `apps/web/src/components/consultations/ConsultationMeetingForm.tsx`
- `apps/web/src/components/consultations/ConsultationsHub.tsx`
- `apps/web/src/components/consultations/FacultyConsultationsPage.tsx`
- `apps/web/src/components/consultations/GoogleMeetConnectModal.tsx` (removed)
- `apps/web/src/components/consultations/GoogleMeetRoom.tsx` (removed)
- `apps/web/src/lib/consultation-store.ts`
- `apps/web/src/lib/meeting-store.ts` (removed)

**Tests and rollout**

- `apps/api/scripts/run-database-integration-tests.mjs`
- `apps/api/src/routes/audit-security.test.ts`
- `apps/api/src/routes/consultation-lifecycle.integration.test.ts`
- `apps/api/src/routes/consultation-workspace.routes.test.ts`
- `apps/api/src/services/google-calendar.service.test.ts`
- `apps/web/src/components/consultations/FacultyConsultationsPage.test.tsx`
- `docs/consultation-calendar-rollout.md`
