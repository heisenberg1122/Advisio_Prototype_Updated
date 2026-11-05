# ADVISIO local QR evaluation

**Branch implementation:** onboarding now opens the selected role dashboard directly. Eight colleges, five switchable roles, four connected scenarios, and ten milestones are described in [the demo accounts implementation](demo-accounts-implementation.md). `/evaluate/guide` is a compatibility redirect. Deployment is a separate action; these branch changes do not establish that the hosted site has been updated. See [the hosting handoff](qr-evaluation-hosting.md) for public links and deployment instructions.

This implementation uses the existing ADVISIO portals and API workflows. It does not replace them with a separate demonstration interface. The entry page is `/evaluate`; the organizer QR sheet is `/evaluate/print`.

## Local use

Requirements: installed project dependencies, a generated Prisma client matching the checked-in schema, and PostgreSQL 18 binaries. On this Windows computer PostgreSQL is installed under `C:/Program Files/PostgreSQL/18/bin`. Override `EVALUATION_PG_BIN` if needed.

1. Run `npm run evaluation:init-local` once. It creates a separate loopback-only PostgreSQL cluster on port **5436**, a database named **advisio_evaluation**, and a private ignored `.env.evaluation.local`. It does not use the existing database on port 5432 or the local-demo target on port 5435.
2. Run `npm run evaluation:dev`.
3. Open **http://localhost:3100/evaluate**. Choose a role and college, acknowledge the fictional-material notice, and select **Begin Evaluation**. Open **http://localhost:3100/evaluate/print** to prepare a role/college QR.
4. Use **Evaluation activities** on the dashboard to find the six activities, prepared revision, and TAM questionnaire. The **Demo role** selector preserves the workspace and college. The questionnaire remains available with incomplete activities. End the session when finished; its fictional records and files are removed.

The initializer reuses its own cluster on later runs and never resets an unrelated database. If that cluster has been stopped, run `evaluation:init-local` again before starting. It does not erase existing evaluation sessions. Initializing a new cluster requires that port 5436 be available.

The local QR points to `localhost`, so it is a **preview for this computer only**. Respondents' phones cannot use that address to reach this computer. Shared phone access needs a separately configured HTTPS evaluation deployment and a QR generated for that origin. This implementation does not publish the service or change production.

## Respondent coverage

Five allowed roles map to native permissions and portals:

| Respondent           | Native role          | Portal                 |
| -------------------- | -------------------- | ---------------------- |
| Researchers/Students | RESEARCHER           | `/student/dashboard`   |
| Research professor   | RESEARCH_COORDINATOR | `/professor/dashboard` |
| Research adviser     | ADVISER              | `/adviser/dashboard`   |
| Evaluation panelist  | PANELIST             | `/panelist/dashboard`  |
| College Dean         | DEAN                 | `/admin/dashboard`     |

The entry offers COA, CEA, CHTM, CIT, CNP, SAS, SBPA, and SOE, using BSA, BSCE, BSTM, BSIT, BSN, BSPSYCH, BSBA-MM, and BEED as representative programs. The previous BSARCH invitation remains valid. The five roles across eight colleges provide 40 selections; program quota metadata is retained for historical invitations and does not impose a respondent quota on the new colleges.

All names, topics, manuscripts, histories, and starting records are fictional. Each workspace contains Projects A-D with distinct research groups and discipline-specific titles. Five-page PDFs include background, objectives, framework, methodology, planned outputs, and supporting information, with explicit fictional-sample labels. Project C starts scheduled and Project D completed. The current panelist has no prefilled Project C scores or annotations. The Coordinator can start C through the existing live-defense controls before the Panelist completes a structured evaluation.

Program-specific research types, rubric criteria, faculty tasks, and the college/program mapping require the study team's discipline review before the event. The app's actual permissions still govern which actions a role may perform.

## Workspace and session isolation

- Each session creates a fresh PostgreSQL schema `eval_<server-generated random ID>`, with its own native tables, constraints, accounts, projects, and records. Native API queries resolve their Prisma client from the request context. Missing evaluation context fails closed, so an evaluation request cannot fall back to the ordinary app database.
- Accounts have one role. Respondents receive an opaque **HttpOnly**, **SameSite=Strict** cookie; the registry stores its SHA-256 hash. No password, JWT, schema ID, or participant code is placed in the shared QR. The browser uses a non-secret evaluation marker only to hydrate the existing portal.
- Request authentication is supplied server-side from the selected session. The evaluation-only switch endpoint accepts just a role, selects its account from the server registry, rotates the cookie, and preserves the college, workspace, and absolute expiry. Native permissions and an additional project scope apply to each account. Institutional invitations, external integrations, signatures, official copy issuance, and ordinary account management remain blocked.
- Files are stored under that session's directory. Local file reads and deletions verify that they stay inside it. The prepared revision endpoint resolves only the current session.
- Sessions expire after **20 minutes idle** or **60 minutes total**. Refresh resumes the same session. Repeated Begin requests with the same browser cookie return the existing session. Ending a session revokes access and removes only its schema/files. Cleanup also runs once a minute and at startup; registry rows remain as operational metadata, not questionnaire responses.
- Native requests are aborted when their session is ended/expired, including long-running streams. Each request also has a bounded session lifetime.
- There is a configurable cap of 20 active/provisioning sessions by default (maximum 50). Provisioning reservations use a database lock to enforce it across API instances. Each workspace uses a one-connection Prisma pool.

This is application-level schema isolation within a **dedicated evaluation database**. The local provisioner owns that evaluation database and is not a hardened public multi-tenant hosting service. Public release needs deployment review, database/user permissions, capacity testing on the intended host, monitoring, and an approved retention policy. Keep the production database and credentials entirely separate.

## Questionnaire handoff

The questionnaire button stays disabled/unavailable until `EVALUATION_SURVEY_URL` is set to a **published Google Forms `/viewform` respondent URL** in `.env.evaluation.local` (then restart the API). A Form editor or preview URL is rejected. The application does not publish or alter Google Forms.

Respondents select/confirm their role and students' program in the existing five-branch form. No ratings or comments are prefilled; no session identifier is sent to Google Forms. Opening the link is not proof of submission. Keep platform-session counts and survey-response counts separate, allow honest ratings after failed/assisted tasks, and use supervised attendance to discourage duplicates. No registration/code workflow means the shared QR cannot itself prove one response per unique respondent.

## Checks and maintenance

- `npm run test:evaluation` checks deployment guards, generated schema identifiers, expiry, concurrent request isolation, and all course/role coverage.
- `npm run test:evaluation:local` requires the evaluation preview to be running. It creates disposable fictional workspaces and verifies all 40 college-role experiences, native actions, milestone completion/locks, role switching, cookie replay rejection, cross-workspace access, idle/absolute expiry, and cleanup. Add `-- --capacity` for the local 20-session cap check. It never submits TAM answers. Custom test ports can use `EVALUATION_TEST_ORIGIN` and `EVALUATION_TEST_API`.
- `node scripts/verify-qr-evaluation.mjs --course=BSIT` is the focused five-role variant.
- Run the API/web type checks and relevant native tests after changes. `evaluation:prepare` regenerates the empty schema SQL and compiles database/email packages. It avoids regenerating the Windows Prisma engine while an existing app is using it. After a model change, regenerate Prisma with dependent servers stopped, then prepare and test again.
- PostgreSQL can be stopped with the installed `pg_ctl` using the exact `.evaluation/postgres` data directory. Stop the evaluation app first. Do not stop the user's ordinary PostgreSQL service or other ADVISIO server.

Implementation files: `apps/api/src/evaluation/`, `apps/web/src/components/evaluation/`, and `scripts/evaluation.mjs`. All evaluation data, credentials, and PostgreSQL files are ignored by Git. The original local-demo safeguards remain intact.

Technical basis: [Node asynchronous context](https://nodejs.org/api/async_context.html), [Prisma connection management](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-management), and [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Historical local validation record — first implementation, 3 November 2026

- All **35 role/program combinations** passed native API operations after the distinct faculty-roster update. These checks exercised the actual uploads, review decisions, consultation approval, Dean overview, and panel save/preview/final submission; no TAM responses were submitted.
- A fresh **20-session concurrent wave** completed native activities across the five roles and seven program templates; a 21st session was refused. The final run, including setup, activities, and cleanup, took **26.6 seconds on this computer**. This is a local functional capacity check, not a prediction of hosted performance or a rehearsal with 20 real respondents.
- The API regression suite passed **599 tests**, with **99 opt-in database integration tests skipped**. The website suite passed **427 tests**. The dedicated evaluation tests are included in the API total.
- API and website type checks/builds passed. The website build retains a bundle-size warning; this does not prevent the local build.
- Browser review verified the entry page, Nursing student portal, Architecture Dean portal, role activity guide, and QR sheet. Session-close prompts now use an in-page confirmation. Screenshots were saved with the evaluation plan outputs.
- Services were verified listening on loopback only: website **3100**, API **5100**, and dedicated database **5436**. No deployment or Git push was performed. The published Google Forms respondent link remains unconfigured.

## Update: Google Form connected; hosted setup prepared

On 3 November 2026 the Form was published with link access and connected to the local app. Role and student program are prefilled using public question entry identifiers; ratings and comments remain blank. See [the hosting handoff](qr-evaluation-hosting.md) for the new Docker/Render files and the remaining deployment steps. The earlier validation record above describes the first local implementation. Hosting sign-in was deferred by the researcher; no public site or phone QR is active yet.
