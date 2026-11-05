# College-scoped evaluation workspaces

Implemented on `codex/qr-evaluation-local`. The production database, ordinary account system, invitation starter URLs, and deployment configuration are unchanged.

## Flow and scope

Respondents choose one of eight colleges and five roles, acknowledge the fictional-material notice, and select **Begin Evaluation**. The native role dashboard opens directly. **Evaluation activities** holds the six role activities, student revision download, and TAM handoff; questionnaire access does not depend on checked activities. Existing `/evaluate/guide` links redirect to the current dashboard or preserve invitation parameters on the entry page.

COA/BSA, CEA/BSCE, CHTM/BSTM, CIT/BSIT, CNP/BSN, SAS/BSPSYCH, SBPA/BSBA-MM, and SOE/BEED are the eight default choices. BSARCH remains accepted for existing CEA program invitations. Additional project titles are explicitly fictional, discipline-specific examples in the evaluation seeder.

Every session seeds all seven projects once. A separate **Demo scenario** selector preserves the college and workspace while opening the selected native task. Student variants use separate fictional researcher identities, each restricted to their own project. Accounts, documents, consultations, grades, notifications, workflow progress, and metrics use native database records within the selected college.

| Scenario | Current milestone              | State                                                                                                              | Visible to                                            |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| A        | M4 Full Manuscript Chapter 1-3 | Awaiting manuscript review                                                                                         | Coordinator, Adviser, Dean                            |
| B        | M3 Chapter 1 to Chapter 3      | Revisions required                                                                                                 | Student, Coordinator, Adviser, Dean                   |
| C        | M5 Title Defense               | Scheduled, published packet; pending manuscript review                                                             | Coordinator, Panelist, Dean                           |
| D        | M6 UAREB Submission            | Completed title defense and fictional review history                                                               | Student variant, Coordinator, Adviser, Panelist, Dean |
| E        | M5 Title Defense               | Live defense; blank evaluation for the current panelist; earlier manuscript feedback and pending latest review     | Student variant, Coordinator, Adviser, Panelist, Dean |
| F        | M10 Final Defense (complete)   | Completed title and final defenses, both badges, locked evaluations, released results, seven-page final manuscript | Student variant, Coordinator, Adviser, Panelist, Dean |
| G        | M5 Title Defense               | Eligible project with pending Coordinator-to-Dean signature request                                                | Coordinator, Dean                                     |

The ten milestones use sequential dependencies. Title Proposal and Adviser use the existing special milestone types. M4 and M9 use the existing defense eligibility type. Completed manuscript milestones have approved PDF versions and submission records; later steps remain locked. Class records cover the seven enrolled project groups and release only fictional prelim scores and attendance, without unpublished final averages.

## Role scenarios and native actions

- **Researchers/Students:** In progress, Live defense, Completed Title Defense, and Completed Final Defense. Completed records display issued badges, released evaluations, and actual workflow completion (5/10 after title, 10/10 after final).
- **Panelists:** Pending manuscript reviews, saved annotation history, live evaluation, and completed title/final results. The live panelist starts with blank scores. Earlier-version annotations do not complete the latest manuscript review. Results list the current panelist's submitted, locked PDFs. Native rules still restrict access to other panelists' private scores.
- **Dean:** Pending signature request, signed request/history, and live/completed defense overview. G contains a real request from the Coordinator addressed to the fictional Dean. C/D/E/F contain real signed PDF successors with signer, date, checksums, and verification codes. The clearly labeled fictional signature and demo password support the ordinary signing flow; explicit confirmation and password verification remain mandatory. The password appears in the Dean activity guide and signing modal.
- **Coordinator:** Pending reviews, live/completed defenses, pending Dean signature, and signed-request Inbox. A prepared fictional approval-letter download is available for exercising the native request flow.
- **Adviser:** Pending review, review history, and live/completed project records.
- **Forms:** Program-specific title/final names cover Accountancy Research, Civil Engineering Design, Architecture Thesis, Tourism Research, Information Technology Capstone, Nursing Research, Psychology Research, Business Research, and Education Research. These are fictional demo templates, not claims about officially approved department rubrics. The supplied eight college logos appear in the form and exported PDF. Original logo files remain untouched; bounded PNG copies are packaged with the API build.
- **Guide and TAM:** Stay in the dashboard evaluation controls with no completion gate on the questionnaire.

## Session protections

`POST /api/evaluation/switch-role` and `POST /api/evaluation/switch-scenario` exist only in evaluation mode and require the private session cookie and configured Origin. Each accepts exactly one known role or scenario identifier, resolves its identity and project scope from server-created registry data, rotates the opaque cookie, and retains the original college and workspace. Old cookie replay is rejected. A full portal reload clears cached data from the previous role.

Switching preserves the original 60-minute absolute expiry and refreshes only idle activity within the existing 20-minute idle limit. Session caps, per-session schema/file cleanup, invitation boundaries, native single-role permissions, and blocked external/administrative actions remain enforced. The only signing exception is a new demo Dean signing an approval document with an Inbox message addressed to that Dean. Normal signing authorization still runs. Signature upload/account management remain blocked. Older sessions without account mappings can continue their original role; they must end and restart to enable the switcher.

The Prisma query extension adds the role's project restrictions to project/document/defense and related model queries, including direct-ID reads. It preserves compound unique selectors at the top level. Outside evaluation request context it adds no filter. Dean student metrics use the same visible project membership scope.

## Verification

Run the standard evaluation API suite, frontend tests, API type check, web build, and hosting configuration checks. `npm run test:evaluation:local` exercises all 40 college-role experiences against disposable schemas, including real uploads, sequential reviews, consultation approval, released grades, Dean approval, PDF annotation/save/preview/share, Coordinator start, live structured evaluation, role/project isolation, cookie rotation, unchanged expiry, cleanup, and expired-session rejection. It does not submit questionnaire responses.

PDF generation checks proposal revisions for five readable pages and final manuscripts for seven pages. Logos and generated evaluation forms are inspected for readable layout. UI verification covers direct onboarding, role/scenario selectors, native evaluation preview and final submission, Dean signature history, student badges and completion, activities and questionnaire access with zero completed activities, legacy guide redirects, and mobile controls.

Deployment remains separate. The Render blueprint has automatic deployment disabled; a branch push does not establish successful CI or a deployed update.

## Follow-up local verification — 6 November 2026

- API regression suite: 637 passed; 108 opt-in integration tests skipped. Web suite: 461 passed. API type check and API/web production builds passed; the web build retains its existing large-chunk warning.
- Eight-college verification: all 40 role experiences and all available role scenarios passed native API checks. Legacy BSARCH also passed. The production API bundle loaded its packaged logos and scenario data.
- Capacity: 20 concurrent workspaces provisioned, session 21 rejected, and cleanup completed. A regression test covers concurrent cleanup of the same expired workspace.
- Browser: real blank live evaluation, save/preview/confirmed final submission, locked result, pending/history manuscript filters, signed Dean Inbox metadata, student title/final badges, and actual 5/10 and 10/10 progress verified. Mobile student content and controls fit a 390px viewport. Cookie-switch profile races and covered native action buttons were corrected during verification.
- PDF: both pages of all eight college evaluation forms, the approval letter, and all seven final-manuscript pages were rendered and inspected. Only CIT uses the Capstone Panel caption.
- These are local results. Exact-commit GitHub Actions and deployment status must be checked separately after pushing the branch.
