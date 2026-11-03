# Dean Defenses and Reports Implementation Plan

Status: Initial scope implemented locally. No deployment or push has been performed.
Date: November 3, 2026

## 1. Objective and scope

Keep both existing sidebar entries and replace their placeholders with focused college-level content:

- **Defenses:** schedules, readiness, outstanding issues, released outcomes, and revision clearance.
- **Reports:** filtered research performance reports with previews and PDF/CSV exports.

The Overview remains a brief summary. These sections provide the details without adding another overview dashboard.

Initial delivery includes three reports: Research Progress, Defense Outcomes, and Adviser Workload. A Dean who is also a panelist can open an assigned defense in the existing Panelist workspace.

Out of scope: a second evaluation form, role-granting changes, scheduling or panel management controls, result-release controls, a new calendar, automated reminders, custom report builders, scheduled exports, historical trend dashboards, archive reports, and changes to unrelated dashboard sections.

## 2. Existing implementation and reuse points

- `apps/web/src/app/admin/dashboard/page.tsx` renders the Dean views; Defenses and Reports currently reach the generic placeholder.
- `apps/web/src/app/admin/layout.tsx` already defines both navigation entries. Change the Defenses page title from “Defense Management” to “Defense Oversight” to match its scope.
- `apps/api/src/routes/dean.routes.ts` supplies college-scoped dashboard data, including project progress and adviser capacity.
- `apps/api/src/routes/live-defense.routes.ts` supplies existing defense and panelist workflows. Its general management response includes broad relational data; do not bind that response directly to a Dean oversight page.
- `packages/database/prisma/schema.prisma` already models sessions, invitations, evaluation records, released decisions, defense events, eligibility cycles, and revision clearance.
- `apps/api/src/services/defense-session-policy.ts` includes accepted panel-assignment checks.
- `apps/web/src/providers/dashboard-workspace-provider.tsx` already supports switching dashboards. Reuse it and the existing `/panelist/defenses/:sessionId` destination.
- The API already depends on `pdf-lib`; reuse it for report PDFs. The API also has an existing CSV export example in `audit.routes.ts`.

Expect no schema migration for the initial release. Confirm this after mapping readiness, evaluation-submission, and revision-clearance fields. Add indexes only if query measurements justify them.

## 3. Defenses page

### Layout

1. Heading and college scope.
2. Filters: program, academic year, defense stage, date range, and search by project/group title.
3. Four summary cards: upcoming, awaiting panel confirmation, needing rescheduling, and completed awaiting result release.
4. Main tabs: **Upcoming**, **Needs Attention**, and **Completed**.
5. Paginated session table with a details drawer.
6. **My Panel Assignments**, shown only when the current college context includes the Panelist role.

Use a list for the first release. A calendar toggle can follow later; the existing Calendar section remains the calendar destination.

### Session table and details

Table columns: scheduled date/time, project/group, program, defense stage, panel confirmation count, session status, attention indicator, and View Details.

The details drawer shows:

- Project title, group, program, academic year, and adviser.
- Defense stage and attempt/cycle context from eligibility/workflow records.
- Schedule, venue or meeting link, and lifecycle status.
- Panel roster and invitation status.
- Preparation requirement status using the existing defense rules.
- Aggregate submitted/required evaluation counts; no draft scores or private comments.
- Released outcome and release date, or “Result not released.”
- Revision instructions and clearance status when permitted by the existing released-result rules.

If legacy records have no reliable stage or clearance mapping, show “Not recorded” or “Unknown”; do not infer completion or clearance.

### Tabs and attention rules

| Item | Rule |
| --- | --- |
| Upcoming tab/card | Future-dated, nonterminal sessions; show drafts as preparation items and clearly distinguish them from confirmed schedules. |
| Needs Attention tab | Noncancelled sessions with at least one explicit attention reason, regardless of whether they are upcoming or completed. |
| Completed tab | `COMPLETED` sessions, including those awaiting release. Display released outcomes only when `releasedAt` is present. |
| Awaiting panel confirmation card | Nonterminal sessions with a required invitation in `PENDING` or `RECONFIRMATION_REQUIRED`. |
| Needs rescheduling card | Sessions in `NEEDS_RESCHEDULING`. |
| Awaiting result release card | `COMPLETED` sessions with no `releasedAt`. |

Additional attention reasons: required panel invitation declined, required panel positions missing, preparation requirements incomplete for a scheduled defense, scheduled start passed without a start/completion, missing final evaluation submissions after a defense ends, and released revisions still awaiting clearance.

Use explicit labels such as “2 panel confirmations pending,” “Schedule needs review,” or “Revision clearance pending.” Missing submissions before a defense are preparation status, not automatically overdue. Call an item overdue only when a stored deadline has passed. Do not invent deadlines or use a project’s `updatedAt` as a defense deadline.

Tabs may overlap: an upcoming session can also need attention. Count each session once per tab/card, even if it has multiple reasons. Label cards as overlapping counts. Show live/deliberating and past-unstarted sessions in Needs Attention with their actual status; exclude cancelled sessions from active counts. Offer a cancelled-status filter for lookup within the page rather than treating cancellation as completion.

### My Panel Assignments

- Limit the list to the current user’s panel/chair invitations in the active college scope.
- Show pending invitations with a link to the existing invitation workflow.
- Show **Open Evaluation** only for an accepted panel assignment when the existing session workflow permits evaluation; otherwise show an appropriate View Defense action.
- Navigate through the existing workspace mechanism and preserve the defense destination and return link.
- Verify the existing switcher can preserve a deep link; extend only that navigation behavior if needed.
- Recheck role, assignment, invitation status, and session state on the server. A visible button is not authorization.
- Do not grant a role, create assignments, or duplicate the scoring workflow from this section.

## 4. Reports page

### Common experience

Use one report selector, relevant filters, a small summary, a paginated preview table, and PDF/CSV export actions. Default academic year to the current year; default program to All Programs. Always display the selected scope and metric definitions.

| Initial report | Preview and metrics | Filters |
| --- | --- | --- |
| Research Progress | Project totals, status and stage distribution, completed count, projects without advisers, and inactivity bands; project detail rows. | Program, academic year, research type, stage, project status. |
| Defense Outcomes | Counts for all five released decision categories, released attempts, distinct projects with released attempts, and outcome distribution by program/stage. | Program, academic year, defense stage, release-date range. |
| Adviser Workload | Active assigned groups, capacity, available slots, accepting-requests setting, and capacity utilization; separate unassigned-group count. | Program, academic year, adviser availability. |

### Metric definitions

- **Research Progress:** one row per project. Reuse the existing workflow progress calculation through a shared helper if needed; label it “Stage-based progress,” not a grade or a prediction. Show no-workflow projects explicitly. Display completed, archived, and cancelled statuses separately.
- **Inactivity:** elapsed days since recorded project update, labeled “No recorded project update for X days.” Explain that project updates may not capture every research activity. Do not describe inactivity alone as a missed deadline.
- **Defense Outcomes:** include only sessions with a nonnull `releasedAt` and valid decision. Date filters apply to release time, not schedule time. Report missing/inconsistent released decisions as data-quality exceptions outside the valid-outcome denominator.
- Count attempts by session ID and distinct projects by research ID. A project with multiple attempts contributes multiple attempts but only one distinct project in the selected scope.
- Keep `APPROVED`, `APPROVED_WITH_MINOR_REVISIONS`, `MAJOR_REVISIONS_REQUIRED`, `REJECTED`, and `REDEFENSE_REQUIRED` separate. Do not introduce a combined pass rate in the initial release.
- **Adviser Workload:** reuse `ACTIVE_ADVISEE_STATUSES` and the current membership/capacity rules. Count distinct active groups; avoid double-counting joined records. Respect college-specific adviser access, including advisers whose home college differs.
- Display both **selected-cohort groups** and **total active load against capacity**. Capacity utilization uses total active load under the existing capacity rules, not the academic-year-filtered subset. Label any broader load scope explicitly; do not expose other colleges’ project details. Zero capacity displays “No capacity,” without division by zero; above-capacity utilization remains visible above 100%.
- Program filters use the project’s program for project counts; retain eligible advisers with zero matching groups and label their faculty program separately. Students and memberships must not inflate project totals.
- These are current-state reports. Academic year identifies the project cohort; it does not reconstruct historical progress or historical adviser load.

### Export contract

- Preview and exports use the same validated filters, authorization, query builder, metric definitions, and ordering.
- Export all matching rows, not just the visible preview page. Display this clearly.
- Include report title, college, filters, generation timestamp, timezone, total rows, and definitions in PDF; include equivalent metadata and named data columns in CSV.
- Produce real downloadable PDFs with repeated table headers, page numbers, readable wrapping, and Unicode-capable names/titles. Do not implement PDF as an unlabeled browser print shortcut.
- Escape CSV delimiters/newlines/quotes and neutralize spreadsheet formula injection in user-supplied cells.
- Set private/no-store response headers and safe filenames; authorize every request and avoid public export URLs.
- Capture one generation timestamp and use a consistent read for each export. A preview and a later export may reflect intervening updates; show each timestamp instead of promising a saved historical snapshot.
- Initial maximum: 5,000 detail rows per export. Detect overflow and ask the user to narrow filters; never silently truncate. Preview totals still cover all matching records. Apply normal API rate limits and a bounded generation timeout.

## 5. API and component design

Proposed API routes, all under the existing `/api` prefix:

| Route | Purpose |
| --- | --- |
| `GET /dean/defenses` | Filtered/paginated rows, counts, filter options, and the current user’s assignment summaries. |
| `GET /dean/defenses/:id` | Scoped oversight DTO for the details drawer. |
| `GET /dean/reports/:reportType` | Report metadata, definitions, totals, and paginated rows. |
| `GET /dean/reports/:reportType/export?format=pdf\|csv` | Export using the same report service and validated filters. |

Use an allowlisted report type (`research-progress`, `defense-outcomes`, `adviser-workload`), validated IDs/date ranges/statuses, bounded search text, allowlisted sort keys, and page sizes of 25 by default / 100 maximum. Include a stable ID tie-breaker in ordering. Return structured validation errors for unsupported combinations.

Suggested implementation files:

- `apps/api/src/routes/dean-defense.routes.ts`
- `apps/api/src/routes/dean-report.routes.ts`
- `apps/api/src/services/dean-defense.service.ts`
- `apps/api/src/services/dean-report.service.ts`
- `apps/api/src/services/dean-report-export.service.ts`
- `apps/api/src/schemas/dean-monitoring.schema.ts`
- `apps/web/src/components/dean/DeanDefensesView.tsx`
- `apps/web/src/components/dean/DeanDefenseDetails.tsx`
- `apps/web/src/components/dean/DeanReportsView.tsx`
- Shared API types in the repository’s existing contract location, confirmed during implementation.

Register new routes in the API entry point. Add explicit `defenses` and `reports` branches in the existing Dean dashboard, while keeping existing views intact. Load these modules through their own queries rather than expanding the already broad dashboard response. Use the existing college/workspace context and include college, user, filters, and pagination in query identity; clear scoped data on context changes.

Store section filters and selected report/tab in URL search parameters so refresh, back navigation, and shareable internal links retain context. Reuse existing design tokens, filter controls, tables, drawers, and authenticated file-download utilities. Keep loading/error/empty states local to each module.

## 6. Authorization and data visibility

- Require authenticated Dean access in the active authorized college context; retain the existing System Admin access convention. For these college reports, require an explicit college scope for System Admin rather than silently aggregating institution-wide data.
- Resolve scope on the server. Validate that requested programs, projects, stages, and sessions belong to it. Detail/export endpoints enforce the same checks as lists.
- Use purpose-built projections. Do not fetch broad management responses and depend on hidden UI columns to protect private fields.
- Dean oversight returns evaluation completion counts and released decisions; exclude raw evaluations, unpublished scores, private deliberation notes, and other panelists’ draft content from payloads and exports.
- A Dean’s additional Panelist role does not change the oversight DTO. Evaluation access goes through the existing participant-authorized endpoints.
- Reuse college membership authorization and current invitation checks. Preserve existing evaluation submission, result-release, and audit-ledger behavior.
- No expansion of existing mutation permissions is required by this plan. If shared helpers need adjustment, limit changes to scoped reuse and add regression coverage.

## 7. Implementation sequence

### Phase 1 — Confirm data mapping and contracts

- Map defense stage, required panel roles, preparation requirements, submitted evaluations, released results, and revision clearance to their authoritative services/fields.
- Confirm active-college resolution, workspace deep links, and adviser capacity scope with the existing implementation.
- Define the DTOs, filters, attention predicates, report formulas, and fixtures before building UI.
- Record missing legacy values as unknown. If a metric cannot be derived reliably, omit it with an explicit explanation rather than fabricate it.

Deliverable: agreed contracts and field mapping within this feature’s implementation notes.

### Phase 2 — Scoped query and aggregation services

- Implement validation, college authorization, minimal projections, summary queries, pagination, and report aggregation.
- Add targeted tests for attention logic, college isolation, decision visibility, and report arithmetic.
- Check query plans for the common college/year/program combinations; avoid per-row queries.

Deliverable: tested read-only API contracts for both sections.

### Phase 3 — Defenses interface

- Replace its placeholder with filters, cards, the three tabs, session details, and cancelled lookup.
- Add My Panel Assignments and the existing-workspace evaluation link.
- Verify expired/removed assignments and context changes cannot leave actionable stale links.

Deliverable: complete Dean defense oversight, with no new scoring or scheduling controls.

### Phase 4 — Reports and exports

- Implement the three report previews and matching PDF/CSV downloads.
- Add metadata, metric definitions, export limits, timestamps, and download feedback.
- Visually verify PDFs with long titles/names, Unicode, empty results, and multiple pages.

Deliverable: three usable reports with consistent downloadable output.

### Phase 5 — Integrated verification and release

- Complete the acceptance checks below and relevant local test/type-check/build commands.
- Review the diff to ensure unrelated dashboards, demo scripts, and existing working-tree changes are untouched.
- If a push is later requested, verify GitHub Actions and deployment for that exact commit. Report remote CI/deployment separately from local checks; investigate relevant failures. This planning task does not include a push or deployment.

## 8. Acceptance and verification

### Functional

- Both sidebar links render their respective content and preserve filters through navigation/refresh.
- All filters affect cards, tables, details, and exports according to their documented scope.
- Multiple attention reasons do not inflate session counts; cancelled sessions do not inflate active counts.
- Completed/unreleased sessions appear without revealing an unpublished decision.
- No-data, missing legacy data, invalid filters, failed downloads, and API errors have clear states.
- Dean-only users have no evaluation action. Dean/Panelist users with accepted assignments reach the existing evaluation page; unassigned, removed, declined, and wrong-college cases are rejected server-side.

### Security and calculation tests

- Exercise college/program tampering on list, detail, preview, and export endpoints, including role changes and direct URLs.
- Assert response/export fields exclude private evaluation data, including when the account holds both roles.
- Verify released-only outcome denominators, multiple attempts for one project, duplicate join rows, zero denominators, and inclusive date filtering using an exclusive next-day boundary.
- Use the institution’s configured timezone; fall back to `Asia/Manila`. Store/query instants consistently in UTC and display the report timezone.
- Verify adviser load across cohorts, zero/over capacity, cross-college faculty membership, and unassigned groups.
- Verify CSV formula escaping, full-result exports, row-limit errors, metadata, and PDF pagination.

### UI and repository checks

- Check desktop and mobile layouts, dark mode, keyboard filters/tabs, drawer focus/escape behavior, accessible table headers, and long text.
- Run targeted new service/route/component tests, relevant existing defense/authorization/workspace tests, `npm run type-check`, and `npm run build`. Run database-backed integration checks when validating scoped queries and defense participation with the repository’s isolated fixture workflow.
- Report unrelated baseline failures separately; do not weaken tests or access controls to obtain a green result.

## 9. Definition of done

The Dean can inspect college defenses, identify concrete outstanding issues, review released results, open their own authorized panel assignment, and generate the three initial reports with matching PDF/CSV exports. Both placeholders are replaced, evaluation remains in the shared Panelist workflow, and the scoped authorization and calculation checks pass.

The initial implementation uses a focused details dialog and a single Dean monitoring router. Legacy defense events can be filtered by their recorded type; eligibility-linked sessions use the recorded workflow stage. No database migration is needed. PDF exports embed Liberation Sans with its included license; CSV preserves characters outside the PDF font's coverage.
