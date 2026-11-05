# College-scoped evaluation workspaces

Implemented on `codex/qr-evaluation-local`. The production database, ordinary account system, invitation starter URLs, and deployment configuration are unchanged.

## Flow and scope

Respondents choose one of eight colleges and five roles, acknowledge the fictional-material notice, and select **Begin Evaluation**. The native role dashboard opens directly. **Evaluation activities** holds the six role activities, student revision download, and TAM handoff; questionnaire access does not depend on checked activities. Existing `/evaluate/guide` links redirect to the current dashboard or preserve invitation parameters on the entry page.

COA/BSA, CEA/BSCE, CHTM/BSTM, CIT/BSIT, CNP/BSN, SAS/BSPSYCH, SBPA/BSBA-MM, and SOE/BEED are the eight default choices. BSARCH remains accepted for existing CEA program invitations. Additional project titles are explicitly fictional, discipline-specific examples in the evaluation seeder.

Every session seeds all four projects once. Accounts, documents, consultations, grades, notifications, workflow progress, and metrics use native database records within the selected college.

| Scenario | Current milestone              | State                                                     | Visible to                          |
| -------- | ------------------------------ | --------------------------------------------------------- | ----------------------------------- |
| A        | M4 Full Manuscript Chapter 1-3 | Awaiting manuscript review                                | Coordinator, Adviser, Dean          |
| B        | M3 Chapter 1 to Chapter 3      | Revisions required                                        | Student, Coordinator, Adviser, Dean |
| C        | M5 Title Defense               | Scheduled, published packet; pending Dean document review | Coordinator, Panelist, Dean         |
| D        | M6 UAREB Submission            | Completed title defense and fictional review history      | Panelist                            |

The ten milestones use sequential dependencies. Title Proposal and Adviser use the existing special milestone types. M4 and M9 use the existing defense eligibility type. Completed manuscript milestones have approved PDF versions and submission records; later steps remain locked. Class records cover the active A-C class and release only fictional prelim scores and attendance, without unpublished final averages.

## Decisions from the concept's open items

- **Live defense:** supported by the app. C begins scheduled so pre-defense annotations can be tried. Switch to Coordinator and start that existing defense, then return to Panelist to complete its live-only evaluation. The server's live-only editing rule is unchanged.
- **Dean action:** uses the native exact-version Dean review/approval assignment for C. Coordinator and Dean see its saved decision in the same workspace. The ordinary app also has signature request infrastructure, but signing is deliberately blocked in evaluation mode; this implementation uses review approval and does not fabricate a signature or claim that approval is a signed scheduling authorization.
- **Evaluation mode:** retains the existing structured rubric. Manuscripts use the existing PDF annotation, preview, and feedback sharing tools. No duplicate viewer or PDF rubric is added.
- **History:** D has a completed defense, earlier manuscript versions, fictional prior panel preparation, and another fictional panelist's evaluation. Native permissions still determine who can see another panelist's private scores; the new respondent's C review starts blank.
- **Guide and TAM:** remain in the dashboard evaluation controls, with no separate guide step and no completion gate on the questionnaire.
- **Invitations:** existing role/program URLs, college aliases, starter links, and QR endpoints remain supported. New organizer choices list the eight colleges.

## Session protections

`POST /api/evaluation/switch-role` exists only in evaluation mode and requires the private session cookie and configured Origin. It accepts exactly a known role, resolves its identity and project scope from server-created registry data, rotates the opaque cookie, and retains the original college and workspace. Old cookie replay is rejected. A full portal reload clears cached data from the previous role.

Switching preserves the original 60-minute absolute expiry and refreshes only idle activity within the existing 20-minute idle limit. Session caps, per-session schema/file cleanup, invitation boundaries, native single-role permissions, and blocked external/administrative actions remain enforced. Older sessions without account mappings can continue their original role; they must end and restart to enable the switcher.

The Prisma query extension adds the role's project restrictions to project/document/defense and related model queries, including direct-ID reads. It preserves compound unique selectors at the top level. Outside evaluation request context it adds no filter. Dean student metrics use the same visible project membership scope.

## Verification

Run the standard evaluation API suite, frontend tests, API type check, web build, and hosting configuration checks. `npm run test:evaluation:local` exercises all 40 college-role experiences against disposable schemas, including real uploads, sequential reviews, consultation approval, released grades, Dean approval, PDF annotation/save/preview/share, Coordinator start, live structured evaluation, role/project isolation, cookie rotation, unchanged expiry, cleanup, and expired-session rejection. It does not submit questionnaire responses.

PDF generation checks all program templates and revisions for five readable pages and rejects page overflow. UI verification covers direct onboarding, the five-role selector, activities and questionnaire access with zero completed activities, legacy guide redirects, and mobile controls.

Deployment remains separate. The Render blueprint has automatic deployment disabled; a branch push does not establish successful CI or a deployed update.
