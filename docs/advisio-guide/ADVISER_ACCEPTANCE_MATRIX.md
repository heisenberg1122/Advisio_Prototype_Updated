# Adviser Guide and AI Assistant acceptance matrix

Use with [the product contract](ADVISIO_GUIDE_PRODUCT_CONTRACT.md) and [the provisional Adviser specification](ADVISER_PHASE2_SPEC.md). This is a checklist for a future implementation, not evidence that it exists today.

## Status and evidence rules

| Classification | Meaning                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| PASS           | Executed at the recorded commit with evidence meeting the expected result.                                 |
| FAIL           | Executed and the observed result contradicts the expected result. Record reproduction and actual behavior. |
| BLOCKED        | A named prerequisite prevents execution. State the dependency and owner; do not treat as PASS.             |
| NOT TESTED     | Not executed. Source review or an earlier release's results do not establish a runtime pass.               |

All feature rows start **NOT TESTED**. The two readiness rows are **BLOCKED** by inspected missing prerequisites, not by a failed runtime test. After prerequisites are supplied, execute and update the relevant rows; do not blanket-mark them PASS. For every executed row, append evidence in the record format below. A checkbox or screenshot alone is insufficient for request/privacy/persistence assertions.

| ID  | Readiness check                           | Expected result                                                                                                                                                                                               | Status  |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| P01 | Compare original detailed Adviser handoff | Original source is supplied, substantive requirements retained, differences reviewed, and provisional label removed only after reconciliation. Missing source: team handoff owner.                            | BLOCKED |
| P02 | Inspect approved shared source/base       | Shared owner supplies Guide/assistant UI, API, registry, validator, preference infrastructure, compliant tour engine, numerical limits, and tests at a recorded SHA. This snapshot lacks these prerequisites. | BLOCKED |

## Test setup

Record application SHA/branch, documentation revision/contract version, named tester, date, browser, viewport, college theme, display mode, fixture identifiers, and active role. Use synthetic accounts and records: two colleges; two groups with different states; permitted and forbidden projects/versions; pending/nonpending requests; capacity available/full/paused; active/inactive exact-version review assignments; missing workflow; consultation states; official-copy present/absent; unset/ON/OFF preferences. Include a multi-role account and two accounts using the same browser. Do not change production data or TAM forms/responses.

Use request interception/counters with sensitive payloads redacted for model counts, validation, cancellation, history limits, and failures. Stub provider success/error responses, including invalid actions and injected instructions. Provider credentials must not enter fixtures or screenshots. Test real authorized integrations only in a permitted environment.

## 1. Guide navigation and visual design

| ID  | Exercise                                | Testable expected result                                                                                                                                                             | Status     |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| G01 | Expanded, collapsed, and mobile sidebar | Guide is directly above Settings, has an accessible name, opens the same role Guide, and remains reachable when launcher is OFF.                                                     | NOT TESTED |
| G02 | Open/close Guide on a task page         | Compact drawer preserves route/project context; desktop workspace remains usable; close restores focus; no oversized centered Guide or excessive blur.                               | NOT TESTED |
| G03 | Use each offered action                 | Show me starts the correct ready tour; Take me there opens the permitted destination; Open Guide opens the matching topic; none submits a workflow action or produces a dead button. | NOT TESTED |
| G04 | Open from several Adviser routes/states | Initial suggestions match current role/page/selection; loading/error is not described as an empty or completed workflow.                                                             | NOT TESTED |

## 2. Adviser-specific help topics

| ID  | Exercise                                                         | Testable expected result                                                                                                                                      | Status     |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| H01 | Ask about Overview and My Advisees, including no groups          | Concise answer explains actual workload/cards/empty state and links only to existing permitted destinations.                                                  | NOT TESTED |
| H02 | Open each group-workspace section                                | Help distinguishes Overview, Documents, Milestones, Consultations, Reviews & Feedback, Defense, Activity, and global views while preserving the chosen group. | NOT TESTED |
| H03 | Ask why a milestone cannot advance; repeat with missing workflow | Answer identifies verified requirements/role gates or reports unavailable state; it does not invent blockers, percentages, approvals, or bypasses.            | NOT TESTED |
| H04 | Ask for Official Copies with present/absent records              | Opens the official register; distinguishes working/submitted/reviewed/signed/published records and reports empty state truthfully.                            | NOT TESTED |
| H05 | Ask about Messages, Inbox, and assistance settings               | Correctly separates group conversations from formal mail, uses real labels/routes, and explains the shared toggle and independent Guide.                      | NOT TESTED |
| H06 | Ask “this group” without a selection, then switch groups         | Assistant requests disambiguation; after selection/switch, answers/actions use the new authorized group with no prior-group leakage.                          | NOT TESTED |

## 3. Interactive spotlight walkthroughs

| ID  | Exercise                                                                   | Testable expected result                                                                                                                            | Status     |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| T01 | Run Overview, advisees/group, request, and review tours                    | Steps match real visible controls, use stable selectors, explain the task conversationally, and point to the correct target.                        | NOT TESTED |
| T02 | Run milestones, consultations, copies, communication, and visibility tours | Each role-specific path reaches the verified state/section and ends or recovers clearly; no substituted unrelated control.                          | NOT TESTED |
| T03 | Scroll/resize/zoom near every viewport edge                                | Small tooltip stays within viewport, flips/clamps as needed, arrow points accurately, and spotlight tracks the visible target.                      | NOT TESTED |
| T04 | Delay data/rendering; remove/hide target or revoke access                  | Bounded readiness wait prevents stale positioning; clear stop/skip/recovery appears when target is absent; no centered fallback pretending success. | NOT TESTED |
| T05 | Back, Next, Skip, Escape, finish, replay                                   | Controls work at first/last/replayed step; focus returns appropriately; no trapped keyboard or stale step index.                                    | NOT TESTED |
| T06 | Tour decision/signing/meeting/message controls with mutation counters      | Tour emits zero academic mutations, messages, signatures, or real meeting launches; user retains existing confirmation workflow.                    | NOT TESTED |

## 4. Adviser requests

| ID  | Exercise                                       | Testable expected result                                                                                                                              | Status     |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| R01 | Pending request: ask how to inspect/respond    | Help opens authorized request details, explains message/PDF/note and existing Accept/Reject flow; pending is not described as accepted.               | NOT TESTED |
| R02 | Full capacity and requests paused              | Guidance explains the actual constraint; acceptance remains blocked by existing UI/server checks; no offered workaround changes permissions/capacity. | NOT TESTED |
| R03 | Nonpending, unavailable, or stale request link | No automatic response or private metadata disclosure; current state/recovery is shown; no invented `/adviser/requests` screen.                        | NOT TESTED |

## 5. Manuscript review behavior

| ID  | Exercise                                                           | Testable expected result                                                                                                                                    | Status     |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| M01 | Open a valid exact assignment/version from help                    | Correct authorized submitted version, assignment, preview, and feedback appear; inconsistent/stale pairs are rejected safely.                               | NOT TESTED |
| M02 | Ask about all four recommendations and invalid feedback/page input | Help accurately explains approve/minor/major/reject, current actionable-feedback/page rules, and existing validation remains enforced.                      | NOT TESTED |
| M03 | Compare previous decision with later researcher revision           | History stays associated with its original immutable version; help distinguishes later submission and remaining academic gates without reversing decisions. | NOT TESTED |
| M04 | Inactive or another reviewer's assignment                          | No active decision action is offered or executed; backend access remains enforced; response does not reveal private review content.                         | NOT TESTED |
| M05 | Ask about endorsement/signing versus manuscript approval           | Help distinguishes them, points only to permitted existing signing controls, never requests passwords in chat or signs automatically.                       | NOT TESTED |

## 6. Consultation guidance

| ID  | Exercise                                                                                            | Testable expected result                                                                                                         | Status     |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| C01 | Requested, scheduled, ongoing, completed, cancelled, and empty fixtures supported by the Adviser UI | Answer matches actual state and permitted next action; no invented schedule, meeting URL, completed session, or role control.    | NOT TESTED |
| C02 | Selected-group notes/actions, then global consultations                                             | Correct group context and visible notes/action items are described; global navigation is labelled; private notes remain private. | NOT TESTED |
| C03 | Missing meeting link/integration; ask Show me                                                       | Safe explanatory fallback appears; no real meeting is launched, invitation sent, or unsaved notes described as saved.            | NOT TESTED |

## 7. AI response accuracy

| ID  | Exercise                                                                                                       | Testable expected result                                                                                                          | Status     |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A01 | Deterministic question set in the Adviser spec                                                                 | Answers match verified topics, roles, routes and states with zero provider calls; no hallucinated features or academic judgments. | NOT TESTED |
| A02 | Unresolved question with relevant verified entries; then unsupported question                                  | First answer uses only relevant authorized grounding; unsupported case acknowledges uncertainty and offers verified Guide help.   | NOT TESTED |
| A03 | Provider returns external URL, executable scheme, cross-role route, unknown action/selector, or mismatched IDs | Shared validator rejects each unsafe action before display/execution; safe answer/Guide fallback remains usable.                  | NOT TESTED |
| A04 | Inject instructions in user/retrieved text; change role/project mid-request                                    | Instructions cannot override access/action rules; obsolete response/action cannot use prior scope.                                | NOT TESTED |
| A05 | Offline, missing key, timeout, rate limit, provider failure                                                    | Clear bounded failure/retry behavior; deterministic help and Guide still work; no fake success or unbounded retries.              | NOT TESTED |

## 8. AI token efficiency

| ID  | Exercise                                                                                    | Testable expected result                                                                                                                                                                            | Status     |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| E01 | Open Guide, replay tour, toggle/close assistant; ask registered navigation/status questions | Request counters show zero model calls for all these deterministic operations.                                                                                                                      | NOT TESTED |
| E02 | One unresolved turn, double-click, rerender, and retry/failure                              | Normal turn uses at most one provider request; no separate model classification or duplicate retrieval; double submission is prevented and retries obey recorded finite policy.                     | NOT TESTED |
| E03 | Long conversation beyond declared history/context caps                                      | Captured redacted payload stays within recorded limits, keeps latest question/necessary context, and excludes full registries/private records; accuracy fixtures still pass.                        | NOT TESTED |
| E04 | Repeat fixtures and switch account/role/college                                             | Shared reuse avoids redundant work within scope, never reuses private cross-scope context; record per-case requests and measured/estimated input/output tokens without claiming unmeasured savings. | NOT TESTED |

## 9. User settings and persistence

| ID  | Exercise                                                                              | Testable expected result                                                                                                                                                    | Status     |
| --- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| S01 | New user/unset preference                                                             | Launcher visible by default, chat closed; no model request is triggered merely by loading the page.                                                                         | NOT TESTED |
| S02 | Settings → Appearance → Workspace Assistance; set OFF and reload/relogin              | Labelled toggle persists explicit OFF under documented storage semantics; launcher remains hidden and Guide usable.                                                         | NOT TESTED |
| S03 | Set ON, open/close chat, re-enter workspace                                           | Launcher appears without auto-opening chat; closing chat preserves ON; workspace entry/reload starts with chat closed.                                                      | NOT TESTED |
| S04 | Toggle OFF while open; migrate unset/false values; use second account in same browser | UI closes/hides correctly, false is never reset to default, accounts are isolated, storage failures have documented recovery, theme/notification preferences remain intact. | NOT TESTED |

## 10. Permissions and multi-college behavior

| ID  | Exercise                                                                       | Testable expected result                                                                                                                      | Status     |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P03 | Authorized versus forbidden project/version/assignment, including direct links | Allowed help/actions work; forbidden data is absent from UI, provider payloads, responses, caches, and logs; server enforcement is unchanged. | NOT TESTED |
| P04 | Two colleges plus unassigned account; change appearance theme                  | Help respects existing academic scope; theme choice never grants another college's data; unassigned state follows existing access policy.     | NOT TESTED |
| P05 | Multi-role account changes workspace; logout and second login                  | Context/actions reflect active permitted workspace; prior private conversation/state does not leak between roles/accounts.                    | NOT TESTED |
| P06 | Inspect client assets/config and redacted prompts/logs                         | No provider credentials, signing passwords, private academic content or unpublished records appear; credentials remain server-side.           | NOT TESTED |

## 11. Mobile, light/dark mode, and accessibility

| ID  | Exercise                                                                 | Testable expected result                                                                                                                                    | Status     |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| V01 | Desktop 1366×768 and phone 390×844/320px width; open keyboard and resize | Drawer/launcher/chat/tours fit viewport with reachable controls, readable text, correct targets, and no horizontal overflow or covered essential controls.  | NOT TESTED |
| V02 | Light, dark, system modes and at least two college themes                | Shared palette/typography remains consistent and readable; arrows/spotlights/focus are visible with no hardcoded college identity.                          | NOT TESTED |
| V03 | Keyboard-only open/actions/tour/close and screen reader                  | Controls have names and logical focus; status/answer changes are announced; Escape and focus restoration work; nonmodal desktop workspace stays accessible. | NOT TESTED |
| V04 | 200% zoom, text enlargement, and reduced motion                          | Content reflows, essential information is not clipped, focus/contrast remain usable, and motion preference is respected.                                    | NOT TESTED |

## 12. Regression testing

| ID  | Exercise                                                                              | Testable expected result                                                                                                                                                        | Status     |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| X01 | Researcher and other-role navigation/help/settings on the approved shared base        | Existing behavior remains compatible with the contract; Adviser content/actions do not bleed into other roles; deviations explicitly reviewed.                                  | NOT TESTED |
| X02 | Existing requests, reviews/history, consultations, milestones, copies, Messages/Inbox | Academic workflows and backend permissions behave as before; help adds no mutations or altered gates.                                                                           | NOT TESTED |
| X03 | Run targeted automated tests, web type check/build, and applicable API/scope tests    | Record each actual command/result at the implementation SHA; failures investigated without disabling tests or weakening access. A local pass does not establish CI/deployment.  | NOT TESTED |
| X04 | Review changed files, dependencies, data/evaluation scope                             | Only authorized Adviser help and coordinated shared changes appear; no Researcher rebuild, unrelated refactor, production data/TAM changes, or unnecessary dependencies.        | NOT TESTED |
| X05 | After any separately authorized push                                                  | GitHub Actions and deployment state are checked for exact pushed SHA and reported separately; running/failed/not deployed remains explicit. No push in this documentation task. | NOT TESTED |

## Evidence record to copy per executed row

```text
ID / status:
Application SHA / branch:
Documentation commit / contract version:
Tester / date / active workspace:
Browser / viewport / college theme / light-dark-system mode:
Synthetic fixture and authorized state:
Steps or exact automated command:
Expected / observed result:
Evidence (test output, screenshot, redacted request counts/token usage):
Deviation, blocker/owner, or follow-up:
Local result:
Remote Actions / deployment result (only after authorized push):
```

Suggested existing commands, after verifying their scope on the implementation base: `npm --workspace=web run type-check`, `npm --workspace=web run build`, and `npm --workspace=web run test -- <affected test paths>`. API tests use `npm --workspace=api run test -- <affected test paths>`. Current adjacent examples include `src/lib/adviser-milestone-flow.test.ts`, `src/lib/project-adviser-requests.test.ts`, and `src/providers/theme-provider.test.tsx` in web, and `src/routes/reviewer-assignment.routes.test.ts`/`src/routes/consultation-workspace.routes.test.ts` in API. These tests exist but do not test the missing Guide/assistant; add meaningful implementation tests for the new behavior. Integration tests need a verified isolated database fixture. Never interpret this command list as tests already executed.
