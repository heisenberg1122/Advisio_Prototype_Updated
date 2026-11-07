# ADVISIO Adviser Phase 2 — Acceptance & Evidence Matrix

**Instructions:** Treat unchecked items as *not yet verified*. Mark PASS, FAIL, BLOCKED, or NOT TESTED and record evidence (test name, screenshot, URL/route, or short explanation). Don't infer success from compile-only checks. Do not perform consequential data mutations in a live environment just to test a tour.

| ID | Test / required result | Status | Evidence |
| --- | --- | --- | --- |
| BASE-01 | Team agrees on the same base repository, branch and commit SHA; no accidental uncommitted carry-over | PASS | Selected local base: main @ 3e2902b73c59f2c5598fb7655c3039db41e01895. Implementation is isolated on codex/adviser-guide-phase2. No tracked edits were present before work; unrelated untracked files were preserved. Other teammates’ checkouts were not inspected. |
| BASE-02 | Existing Researcher Guide/AI and shared components identified; no duplicate backend/launcher created | PASS | Reused GuideDrawer, GuidedWalkthrough, the floating assistant, account visibility storage, and the existing authenticated assistant router and provider. |
| UI-01 | **Guide** item with icon is immediately above **Settings** in Adviser sidebar, including collapsed/mobile | PASS | The Adviser Guide was opened in expanded desktop, collapsed desktop, and mobile navigation. The Guide button is immediately before Settings in the existing utility footer. |
| UI-02 | Clicking Guide opens a right-side **nonblocking** drawer; no full-page blur or oversized center modal | PASS | Browser verified the right-side dialog is nonmodal; the desktop screenshot shows the unobstructed workspace beside it. |
| UI-03 | Drawer has search, useful current-page help, popular questions, topics, and Start Tour inside Guide | PASS | Browser verified the contextual card, popular questions, search, browse categories, and optional Start guided tour inside Guide. |
| UI-04 | Current-page help changes on navigation; topic search supports common paraphrases | PASS | Overview, Advisees, and Reviews display their corresponding contextual help. The Adviser Guide tests exercise both partial search and paraphrase matching. |
| UI-05 | Chat floating button ON by default with no stored choice; chat panel not automatically opened | PASS | Browser verified the launcher is visible before any saved choice and the chat is initially closed. |
| UI-06 | Settings OFF immediately hides floating button and stays OFF after refresh/login; Guide stays usable | PASS | Switching OFF hid the launcher immediately; it remained off after authenticated reload. Guide remained available. |
| UI-07 | User preference isolation is verified across two accounts; no reset of existing Researcher preference | PASS | The existing same-storage Alice/Bob test verifies account isolation, including explicit OFF. The Researcher and Adviser use the same unchanged account key. |
| VIS-01 | Tooltips point to real controls with correctly connected arrows; target is not obscured | PASS | Browser verified anchors on assignment selection, version and feedback, recommendation, request controls, group workspace, and consultation fields. Screenshots show the connected arrow. |
| VIS-02 | Works after navigation, async loading, scroll, collapsed nav; safe exit if a target is missing | NOT TESTED | Navigation, async loading, internal scrolling, collapsed navigation, and empty-state exits were exercised. A timed-out target and Retry after recovery were not forced in the final browser run. |
| VIS-03 | Visually checked desktop/mobile, dark/light mode, keyboard/focus and reduced motion | PASS | Edge 1440×930 and 390×844. Guide and chat captured in light/dark. Reduced-motion context and Escape exit verified. This was not a full assistive-technology audit. |
| FLOW-01 | **AD-01/02:** My Advisees → authorized group → group workspace; zero-group fallback | PASS | Selected the second of two authorized group cards and landed on its workspace. The separate zero-group fixture anchored the empty state. |
| FLOW-02 | **AD-03/04/05:** adviser request discovery/decision explanation/capacity without submitting a response | PASS | Opened a real rendered pending request in the fixture. Accept was disabled at full capacity, and no decision request was sent. Empty requests have their own anchored explanation. |
| FLOW-03 | **AD-06/07:** active Reviews assignment → exact version → feedback and decision controls; no submission | PASS | Guide and assistant both reached the assignment. Browser opened Version 2, then found the preview, Overall feedback, previous decisions and Recommendation. No decision submitted. |
| FLOW-04 | **AD-08/09/10:** review choices, version history and inactive/revoked/superseded statuses correctly explained | NOT TESTED | Version and recommendation controls plus earlier-decision area were reached. The fixture included completed, revoked, reassigned and superseded records; each historical row, document-history path, and restricted or missing snapshot was not individually exercised. |
| FLOW-05 | **AD-11/12:** group progress and milestone approval explained; no actual approval | BLOCKED | AD-11 passed: the selected group stays active through Milestones and Activity. AD-12 cannot point to a real approval: the existing queue initializes empty and never loads approval records. The guide reports this and directs users to progress and the coordinator. A real approval source is needed before retesting. |
| FLOW-06 | **AD-13/14/15:** consultation schedule/requests/history/integration shown if supported; no meeting created | PASS | Opened scheduling and spotlighted group, topic, date and time. Verified history navigation and meeting-action presence/absence with synthetic sessions. No real calendar or Meet call was made. |
| FLOW-07 | **AD-16:** Official Copies explained with correct view/download boundary | PASS | Browser navigated to Official Copies, selected the second group, and found its authorized empty archive. Guide explained existing view/download permissions. No production document was accessed. |
| FLOW-08 | **AD-17/18/19:** Messages vs Inbox, theme vs college, assistant settings all accurately routed | PASS | Browser verified Messages and Inbox sidebar anchors, theme and college controls, and the assistant preference. No message was sent. |
| FLOW-09 | Intro tour follows meaningful advising journey, is conversational, and not generic 4-slide narration | PASS | Browser followed Overview → chosen group → Milestones → Reviews → requests → Consultations → Guide. It required no business action. |
| STATE-01 | Empty/missing/pending/active/completed/unauthorized state handling is truthful and doesn't fake records | NOT TESTED | Verified zero/multiple groups, empty/pending requests, capacity full, active/empty review queue, and confirmed/absent meeting links. Restricted snapshot and every historical-state combination remain unverified. |
| RBAC-01 | Active role + active approved college used; multi-role switch cancels incompatible tour and restricts data | PASS | The route tests reject Researcher and Panelist requests for Adviser help, cross-workspace topic IDs, and Adviser without a college. Browser switched an Adviser/Panelist fixture to a Panelist-only approved college and verified the Adviser drawer and chat were dismissed. |
| AI-01 | High-confidence registry navigation Qs make **no model call** (verify via stub/mock/telemetry) | PASS | Provider stub: 5 Adviser FAQ requests resolved locally, 0 provider calls, 0 input/output tokens. Browser review FAQ also returned verified workspace help without model calls. |
| AI-02 | Complex Q uses shared backend with limited relevant knowledge; no redundant classification/model chain | PASS | Consented complex comparison used one stubbed request with two Adviser entries and no account/college IDs. Stub reported 120 input and 45 output tokens. No live provider billing or integration was tested. |
| AI-03 | Invalid/AI-generated routes are rejected; only verified action IDs launch navigation | PASS | API rejects model-generated cross-role IDs; web tests reject unauthorized topic actions and resolve navigation from the workspace allowlist. |
| AI-04 | Model unavailable: correct local help fallback and clear non-misleading status | PASS | Browser asked a comparison with the model unavailable and received the verified Guide fallback. |
| PRIV-01 | No manuscripts, private messages, grades or student records sent to provider by default | PASS | Provider receives only typed question/history and vetted help, with opt-in off by default. The synthetic browser read manuscripts through the normal preview API; no manuscript body or record was sent through the assistant. |
| PRIV-02 | Auth, rate limits, server-side secrets, bounded input/history, safe logging verified | PASS | Shared tests verify auth, rate limits, input/history bounds, one request, token accounting, and aggregate metrics without private identifiers. Provider credentials stay server-side. |
| SAFE-01 | No review decision, request approval, consultation, message, milestone or other business record mutated by tour/AI | PASS | Browser fixture rejects consequential API mutations; the full scenario logged zero attempts. The automated Guide test also checks that consequential controls are observation-only. |
| SAFE-02 | Researcher, Panelist, Dean and TAM behavior unchanged except necessary shared nonbreaking changes | PASS | No business-rule, TAM, permission-definition or database changes. The full web suite and existing Researcher assistant tests passed. No live deployment was exercised. |
| BUILD-01 | Relevant automated tests pass; report exact commands and any failures | PASS | 588 web tests and 28 focused API tests passed. See commands below. |
| BUILD-02 | Project lint/typecheck/build checks run as available and results recorded | PASS | Lint, type checks, and production build succeeded. Vite reported a bundle-size warning. |
| PROOF-01 | Screenshots supplied for Adviser Guide drawer and AI chat in light/dark plus mobile layout | PASS | Desktop light/dark and mobile dark screenshots for Guide and chat, plus four Adviser task spotlight screenshots. See local artifact links below. |
| PROOF-02 | Short final summary includes changed files, pass/fail matrix, blocked cases, and measured AI bypass | PASS | This matrix records the baseline, changes, test commands, provider bypass, and outstanding evidence. |

## Five golden checks (demonstrate, don't just describe)

1. **Find a group:** “Where are my advisees?” → My Advisees → real group or helpful no-group state.
2. **Review a version:** “How do I review a manuscript?” → Reviews → correct assigned version → review controls; no write executed.
3. **Adviser request:** “How do I respond to a request?” → exact pending request location; available response choices highlighted; no acceptance sent.
4. **Consultation:** “How do I schedule a consultation?” → correct scheduling fields, no actual meeting created.
5. **Model bypass:** common navigation FAQ gives accurate actions with 0 provider calls; a genuinely complex question can use AI with relevant limited context.


## Local verification results

31 passed, 1 blocked, 3 not fully tested, 0 failed. Scope: Adviser help topics AD-01 through AD-19. AD-12 provides the existing queue's limitation and a safe next step. The release remains on the local feature branch; there was no commit, push, merge, deployment, or change to production or TAM data.

| Command | Result |
| --- | --- |
| npm --workspace=web run test -- --maxWorkers 4 | 71 files, 588 tests passed |
| npm --workspace=api run test -- src/routes/researcher-assistant.routes.test.ts src/services/researcher-assistant.service.test.ts | 2 files, 28 tests passed |
| npm run lint | Passed |
| npm run type-check | Passed |
| npm run build | Passed; Vite reported a chunk-size warning |
| node --import tsx .local/adviser-guide-qa/browser.mjs | Passed in Edge desktop 1440×930 and mobile 390×844 using local synthetic responses; zero unexpected writes or uncaught browser errors |
| git diff --check | Passed |

Vitest's initial sandbox attempt could not access generated files under its default temp directory. The passing runs used TMP/TEMP under .local/adviser-guide-qa; the API router suite used a loopback listener. The browser used the real local SPA, mocked authenticated responses and a synthetic manuscript PDF. It did not need live faculty accounts, production records or external services.

Provider bypass: the browser produced two registry responses and one unavailable-model fallback from three help requests, with zero provider calls and zero tokens. The separate service test produced five registry responses from five Adviser FAQs. One additional complex-question test used a stubbed provider and observed 120 input and 45 output tokens; these were fixture values, not billed usage.

## Local screenshots

- [Guide, desktop light](../../../../.local/adviser-guide-qa/screenshots/guide-desktop-light.png)
- [Guide, desktop dark](../../../../.local/adviser-guide-qa/screenshots/guide-desktop-dark.png)
- [Guide, mobile dark](../../../../.local/adviser-guide-qa/screenshots/guide-mobile-dark.png)
- [Assistant, desktop light](../../../../.local/adviser-guide-qa/screenshots/assistant-desktop-light.png)
- [Assistant, desktop dark](../../../../.local/adviser-guide-qa/screenshots/assistant-desktop-dark.png)
- [Assistant, mobile dark](../../../../.local/adviser-guide-qa/screenshots/assistant-mobile-dark.png)
- [Review assignment](../../../../.local/adviser-guide-qa/screenshots/review-assignment-spotlight.png)
- [Review recommendation](../../../../.local/adviser-guide-qa/screenshots/review-decision-spotlight.png)
- [Adviser request at full capacity](../../../../.local/adviser-guide-qa/screenshots/request-capacity-spotlight.png)
- [Consultation form](../../../../.local/adviser-guide-qa/screenshots/consultation-spotlight.png)

## Changed files

- [researcher-assistant.routes.test.ts](../../../../apps/api/src/routes/researcher-assistant.routes.test.ts) — `apps/api/src/routes/researcher-assistant.routes.test.ts`
- [researcher-assistant.routes.ts](../../../../apps/api/src/routes/researcher-assistant.routes.ts) — `apps/api/src/routes/researcher-assistant.routes.ts`
- [researcher-assistant.service.test.ts](../../../../apps/api/src/services/researcher-assistant.service.test.ts) — `apps/api/src/services/researcher-assistant.service.test.ts`
- [researcher-assistant.service.ts](../../../../apps/api/src/services/researcher-assistant.service.ts) — `apps/api/src/services/researcher-assistant.service.ts`
- [page.tsx](../../../../apps/web/src/app/adviser/advisees/%5BresearchId%5D/page.tsx) — `apps/web/src/app/adviser/advisees/[researchId]/page.tsx`
- [page.tsx](../../../../apps/web/src/app/adviser/dashboard/page.tsx) — `apps/web/src/app/adviser/dashboard/page.tsx`
- [page.tsx](../../../../apps/web/src/app/student/documents/page.tsx) — `apps/web/src/app/student/documents/page.tsx`
- [AdviserResearchGroupCard.tsx](../../../../apps/web/src/components/adviser/AdviserResearchGroupCard.tsx) — `apps/web/src/components/adviser/AdviserResearchGroupCard.tsx`
- [AdviserSidebar.tsx](../../../../apps/web/src/components/dashboards/adviser/AdviserSidebar.tsx) — `apps/web/src/components/dashboards/adviser/AdviserSidebar.tsx`
- [ManuscriptReviewWorkspace.tsx](../../../../apps/web/src/components/documents/ManuscriptReviewWorkspace.tsx) — `apps/web/src/components/documents/ManuscriptReviewWorkspace.tsx`
- [FloatingResearcherAssistant.tsx](../../../../apps/web/src/components/guide/FloatingResearcherAssistant.tsx) — `apps/web/src/components/guide/FloatingResearcherAssistant.tsx`
- [GuideDrawer.tsx](../../../../apps/web/src/components/guide/GuideDrawer.tsx) — `apps/web/src/components/guide/GuideDrawer.tsx`
- [GuidedWalkthrough.tsx](../../../../apps/web/src/components/guide/GuidedWalkthrough.tsx) — `apps/web/src/components/guide/GuidedWalkthrough.tsx`
- [guide-geometry.ts](../../../../apps/web/src/components/guide/guide-geometry.ts) — `apps/web/src/components/guide/guide-geometry.ts`
- [guided-walkthrough-types.ts](../../../../apps/web/src/components/guide/guided-walkthrough-types.ts) — `apps/web/src/components/guide/guided-walkthrough-types.ts`
- [researcher-guide.css](../../../../apps/web/src/components/guide/researcher-guide.css) — `apps/web/src/components/guide/researcher-guide.css`
- [AppSidebar.tsx](../../../../apps/web/src/components/layout/AppSidebar.tsx) — `apps/web/src/components/layout/AppSidebar.tsx`
- [AppTopbar.tsx](../../../../apps/web/src/components/layout/AppTopbar.tsx) — `apps/web/src/components/layout/AppTopbar.tsx`
- [CollegeSwitcher.tsx](../../../../apps/web/src/components/layout/CollegeSwitcher.tsx) — `apps/web/src/components/layout/CollegeSwitcher.tsx`
- [AccountSettingsPage.tsx](../../../../apps/web/src/components/settings/AccountSettingsPage.tsx) — `apps/web/src/components/settings/AccountSettingsPage.tsx`
- [adviser-guide.test.ts](../../../../apps/web/src/lib/adviser-guide.test.ts) — `apps/web/src/lib/adviser-guide.test.ts`
- [adviser-walkthroughs.ts](../../../../apps/web/src/lib/adviser-walkthroughs.ts) — `apps/web/src/lib/adviser-walkthroughs.ts`
- [researcher-guide-provider.tsx](../../../../apps/web/src/providers/researcher-guide-provider.tsx) — `apps/web/src/providers/researcher-guide-provider.tsx`
- [workspace-tour-provider.tsx](../../../../apps/web/src/providers/workspace-tour-provider.tsx) — `apps/web/src/providers/workspace-tour-provider.tsx`
- [adviser-help.ts](../../../../packages/shared/src/adviser-help.ts) — `packages/shared/src/adviser-help.ts`
- [researcher-assistant.ts](../../../../packages/shared/src/researcher-assistant.ts) — `packages/shared/src/researcher-assistant.ts`
- [researcher-help.ts](../../../../packages/shared/src/researcher-help.ts) — `packages/shared/src/researcher-help.ts`

The handoff package is organized here under docs/advisio-guide/roles/adviser, with the shared contract at docs/advisio-guide/ADVISIO_GUIDE_PRODUCT_CONTRACT.md. The supplied anti-examples are reference material only.
