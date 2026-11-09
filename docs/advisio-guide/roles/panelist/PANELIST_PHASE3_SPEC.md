# ADVISIO — Phase 3: Panelist Guide & Floating AI Assistant

**Scope:** Panelist workspace only. **Implementation owner:** third teammate. **Dependency:** shared Researcher Guide/AI infrastructure and team-approved product contract. **Status:** implementation specification; not a claim the code already satisfies it.

## Outcome and priorities

Build a polished, conversational, state-aware Guide and floating AI Assistant for authorized defense panelists. Users should understand how to receive invitations, access defense materials, review manuscripts, prepare and submit evaluations, and inspect appropriate results. Prioritize (1) actual role permissions and data accuracy; (2) helpful guided task paths; (3) visual polish and accessibility; (4) low model/token cost; (5) minimal shared-code churn.

**Do not implement other dashboards or create a duplicate chatbot/LLM endpoint.** Reuse shared components. Only fix shared defects when unavoidable and coordinate their ownership with the team.

## 1. Preflight and code audit

Confirm `git status --short`, `git branch --show-current`, `git rev-parse HEAD`. Get the shared base branch and exact SHA from the team. Do not assume the branch previously called `codex/qr-evaluation-local` is current. Create an isolated Panelist feature branch only after verifying the base. Protect uncommitted work. Check current `AGENTS.md` and newer team-approved `ADVISIO_GUIDE_PRODUCT_CONTRACT.md`; reconcile documentation changes rather than overwriting.

Targeted source audit (verify files on actual checkout):

- `apps/web/src/components/dashboards/panelist/PanelistSidebar.tsx`
- `apps/web/src/components/dashboards/panelist/PanelistTopbar.tsx`
- `apps/web/src/app/panelist/dashboard/page.tsx`
- `apps/web/src/app/panelist/defenses/[sessionId]/page.tsx`
- `apps/web/src/app/panelist/reviews/page.tsx`
- `apps/web/src/components/panelist/DefensePacketReview.tsx`
- `apps/web/src/components/panelist/PdfEvaluationWorkspace.tsx`
- `apps/web/src/components/panelist/StructuredEvaluationWorkspace.tsx`
- `apps/web/src/components/documents/ManuscriptReviewWorkspace.tsx`
- Panelist settings, consultations, calendar, messaging, official copies and shared Guide/AI/tour/preference components.

Inspect interfaces, routes, permission guards, async loading, invitation status, panel defense packet lifecycle, available evaluation modes, mutable draft versus locked result, and active-college scope. Use selective file reads; do not ingest large unrelated files.

## 2. Verified navigation reference, subject to recheck

| Panelist navigation | Route |
| --- | --- |
| Overview | `/panelist/dashboard` |
| Manuscript Reviews | `/panelist/reviews` |
| Official Copies | `/panelist/documents?tab=official` |
| Evaluations | `/panelist/dashboard?tab=evaluation` |
| Results | `/panelist/dashboard?tab=grades` |
| Defense Schedule | `/panelist/dashboard?tab=schedule` |
| Consultations | `/panelist/consultations` |
| Calendar | `/panelist/calendar` |
| Messages | `/panelist/dashboard?tab=messages` |
| Inbox | `/panelist/inbox` |
| Defense session workspace | `/panelist/defenses/[sessionId]` |

Manuscript Reviews has an Assigned Reviews view and a Defense Packets view. A packet link can include a `sessionId` to select a defense. Verify navigation buttons, route parameters, and visible controls before authoring tutorial targets.

## 3. UI contract — extend the existing shared assistant

- In Panelist sidebar utility area place **Guide** with `BookOpenText` (or established shared icon) directly above Settings, with Sign Out after. Use existing placement and collapsed/mobile behavior. Opening Guide presents a nonblocking right drawer (~380–420 px desktop), **not** a centered full-screen blurred modal.
- Drawer subtitle **Panelist Workspace**, question prompt **“What can we help you with?”**, searchable natural-language questions, current-page help, popular questions, browse categories, and **Start guided tour** *inside* Guide.
- Floating AI button uses established shared icon, colors, radius, hover, responsiveness, focus styles. Panel title **Advisio Assistant · Defense Panelist**. Button visible by default where no saved preference exists; chat stays closed until clicked. Settings → Appearance → Workspace Assistance → **Show floating AI Assistant** hides or restores it persistently. Preserve existing account-wide or role-scoped preference semantics; never re-enable an explicit OFF choice. Guide remains usable when AI is hidden.
- Suggested chat greeting: **“Hi! Need help finding a defense invitation, reviewing a manuscript, or completing an evaluation?”** Chips: **Find my invitation**, **Review defense materials**, **Save an evaluation draft**, **Check my results**.
- Reuse existing **Show me**, **Take me there**, **Open Guide** actions, stable target selectors, route-aware spotlight/connected arrow, auto-expanded navigation, safe interactions, missing-target recovery and minimizing the chat during walkthroughs.
- Responses sound like a helpful colleague, not a training manual; explain **where → what to do → what happens next**. Support ordinary English and common Taglish queries as feasible. Avoid long generic tours and fictitious example records.

## 4. Critical product distinctions (do not collapse these)

1. **Panel invitation is not a review or evaluation.** The panelist may need to accept an invitation before accessing defense packets; a pending/reconfirmation-required/declined assignment is not the same as an accepted one.
2. **Assigned Reviews** (`/panelist/reviews`) uses the shared `ManuscriptReviewWorkspace`. **Defense Packets** (`/panelist/reviews?tab=defense-packets`) includes the published, version-specific defense packet, private notes, annotations, revision checklist, evaluation tab, and recommendation form where available.
3. **Evaluation mode varies by defense/session configuration:** structured digital scoring, PDF evaluation, or other supported legacy rubric flow. Inspect `evaluationMode` and actual UI; never force the wrong mode or imply every session exposes the same form.
4. **Pre-defense vs live session:** some scoring unlocks only when the defense becomes `LIVE`. Published packet review may be available earlier if authorized. Distinguish these phases.
5. **Draft vs final:** saving a draft is not final submission. A final evaluation may require rubric completion, PDF preview and explicit confirmation/signature depending on mode, and becomes **locked**. Tour actions must never actually finalize or lock anything.
6. **Private notes vs shared annotations:** the panelist defense packet and PDF manuscript tools can have separate private/shared effects. Do not claim all comments are visible to researchers, or share any annotations automatically during a tutorial.
7. **Personal locked evaluation vs official released results:** panelists may see their own submitted/locked evaluation, while an overall released decision can be separately gated by publication/release status. Do not expose unreleased group/consensus results or promise immediate student visibility.
8. **College scope and faculty multi-role:** active authorized Panelist workspace + college determines access. Having Adviser or Dean elsewhere on the same account grants no cross-college access.

## 5. Role-specific Guide topics and complete interactive walkthroughs

Create a role-owned `PanelistGuideRegistry` or equivalent using established registry interfaces. Each topic requires ID, category, real question + synonyms, verified concise answer, authorized route, prerequisites, state variants, supported action IDs, walkthrough, and fallback. Show only valid actions and targets. Implement these scenarios, rechecking behavior in UI:

### PN-01. Where do I start as a panelist?
Welcome, explain dashboard overview of assigned research projects, invitations, review work, upcoming defenses and evaluations. Launch **Explore panelist workspace** tour; not a feature-name slideshow.

### PN-02. Where can I see my defense invitations?
Guide **Defense Schedule** or actual invitation surface. Show pending, accepted, reconfirmation-required, declined and unavailable states where supported. Explain tentative vs confirmed schedules. On empty state: “Your panel assignments will appear here once they're available.” Do not invent an invitation.

### PN-03. How do I accept or decline an invitation?
Highlight actual invitation card and its details; explain response options, required reason on decline where applicable, scheduling implications, and confirmation state. Stop before final action. **Never click Accept/Decline or send a decision automatically.**

### PN-04. Where is my defense schedule?
Guide to `/panelist/dashboard?tab=schedule`; identify time, venue/online link, invitation status and **Open session** action for a real authorized session. Differentiate absent venue, tentative, confirmed, completed or rescheduling states. Do not fabricate dates, meeting URLs or “open now”.

### PN-05. How do I open my defense session?
Use real session card to open `/panelist/defenses/[sessionId]`; explain timeline/checklist for invitation, packet publishing, manuscript review, evaluation unlock, and official result release. Respect prerequisites.

### PN-06. Where are the manuscripts assigned to me?
Differentiate general **Manuscript Reviews** queue and defense **review packet**. Use correct real route and selection; if user means the defense's published packet, prefer session review packet rather than the unrelated reviewer-assignment page.

### PN-07. How do I review the defense manuscript?
Guide to the defense packet (`/panelist/reviews?tab=defense-packets&sessionId=<authorized>` or verified UI action), published immutable manuscript, version preview, annotations, notes, checklist, and review-complete affordance. Explain private notes and shared annotations accurately. **Do not save, publish, or mark reviewed** during the tour.

### PN-08. How do I leave feedback on an assigned manuscript version?
Guide to `/panelist/reviews`, find actual active reviewer assignment, open exact version, explain comment and recommendation controls in `ManuscriptReviewWorkspace`. Handle completed, revoked, reassigned, superseded or inaccessible assignments. Do not confuse this with the defense packet workflow or submit feedback.

### PN-09. Where can I see earlier manuscript versions?
Highlight verified version history within active authorized review context. Clarify the version currently under review and why comments on earlier versions may be distinct. Do not guess whether old comments carry forward.

### PN-10. What is the panel recommendation form?
Inspect whether a session exposes this flow (review packet recommendation draft, preview, confirm/lock). Explain the exact availability and finality of controls. Never generate/confirm/lock a recommendation in a walkthrough. No policy guidance beyond implemented rules.

### PN-11. How do I start an evaluation?
Open `/panelist/dashboard?tab=evaluation` with the appropriate authorized `sessionId`. Determine active evaluation mode and session status. Explain why scoring may remain locked until LIVE. Differentiate draft vs final and where the rubric/template comes from.

### PN-12. How do I save an evaluation draft?
For supported mode, point to actual scoring fields and **Save draft**, explain what remains editable and private. For PDF mode, explain annotation/signature conditions where visible; for structured mode, show actual criteria/answers and preview flow. Do not save a real draft merely to demonstrate it.

### PN-13. How do I submit a final evaluation?
Explain exact per-mode prerequisites: complete scores where required, review generated PDF where applicable, explicit confirmation/signature as implemented, then final submission. Highlight final controls but **never execute the final submission, sign on behalf of user, or lock the evaluation**. Explain irreversibility when supported.

### PN-14. Why is my evaluation unavailable or locked?
Distinguish no assignment, invitation not accepted, packet not published, session not LIVE, template missing, already locked, or permission mismatch using actual state. Provide a trusted explanation or a nonfabricated fallback. Avoid stating one cause without evidence.

### PN-15. Where can I see my submitted evaluation?
Guide to **Results** and/or completed evaluation view. Differentiate a personal locked evaluation, completed PDF and official released decision; never claim unreleased results are final or visible to students.

### PN-16. How do I find official results or recommendations?
Show applicable results section and explain what the system actually exposes after authorized release. If release pending, say so clearly. Distinguish personal score from aggregate outcome.

### PN-17. Where do I find official copies?
Guide to `/panelist/documents?tab=official`, distinguish official archival copies from editable drafts/review packets. Respect scope and download permissions. No editing/signing/finalizing.

### PN-18. How can I find consultations and calendar events?
Guide to existing `/panelist/consultations` and `/panelist/calendar`. Explain only actions actually supported for Panelists. Do not reuse Adviser-specific scheduling claims without verification.

### PN-19. How can I contact the relevant faculty or group?
Guide to Panelist Messages or Inbox based on actual communication permissions. No automatic sends, no claims that academic review notes are always shared via chat.

### PN-20. How do I change appearance or hide the assistant?
Use real theme toggle and `/panelist/settings` → Appearance → Workspace Assistance. Distinguish UI color theme from active-college switching and confirm the assistant can be hidden while Guide stays available.

## 6. Introductory tour — coherent story

1. **Welcome:** “This is where your panel assignments and upcoming defense activities come together.”
2. **Overview:** point to actual assigned projects / upcoming work.
3. **Defense Schedule:** “When you're invited to a defense, you can check its schedule and reply here.”
4. **Session workspace:** show a real authorized session or describe the empty-state route without inventing one.
5. **Manuscript review:** “Before scoring, review the assigned manuscript and the available defense materials.”
6. **Evaluation:** explain scoring only during permitted phase; drafts and final lock are distinct.
7. **Results:** “After submitting, you can find your completed evaluation; official decisions may require release.”
8. **Official Copies and communication:** introduce only as needed, with actual targets.
9. **Finish:** “Need help with a specific step? Open Guide or ask Advisio Assistant anytime.”

Flexible steps; skip irrelevant or nonexistent items, offer task-depth guides. Small anchored tooltips, arrows connected to real controls, Back/Next/Exit, cross-route state, loading recovery, mobile. Do not expose actual private records in example tooltip text or take consequential actions.

## 7. Token-efficient shared AI behavior

**Don't introduce another model stack, chatbot, endpoint, chat-history store or vector DB.** Reuse current authenticated backend, cost instrumentation and deterministic-first router.

- Tier 1: high-confidence static FAQs (“Where is Defense Schedule?”, “Where are my evaluations?”) resolved from Panelist guide registry **without model calls**.
- Tier 2: minimal authorized state (“Why is my evaluation locked?”) resolved deterministically if supported by actual state; otherwise explain uncertainty.
- Tier 3: AI for ambiguous/multi-intent requests, with active role/page, 3–5 relevant verified entries if sufficient, minimal safe state, bounded recent dialogue. No manuscripts, submitted scores, private notes, personal identities or leaked role/college records in prompts by default.
- Never let the model produce unchecked routes or execute backend writes. Validate actions against role/state/college allowlist, and treat retrieved records as untrusted content.
- Keep concise answers and optional Show me / Take me there / Open Guide. Don't sacrifice required details to meet arbitrary output caps.
- Track deterministic vs model calls, provider tokens (if available), cost/latency, fallback, error conditions; avoid unnecessary retries or duplicate model-based intent classification.
- Graceful provider-unavailable fallback to deterministic Guide. Do not introduce AI requests on page load.

## 8. Role/privacy/academic safety

- Only active authorized Panelist + selected permitted college sees Panelist help/action links; revalidate after role/college switching. Reuse existing server-side restrictions, avoid new permissions.
- No cross-college data leakage, private document text or raw evaluation content sent to LLM by default. Keep keys server-side and rate limits in place.
- No automatic invitation replies, annotation sharing, manuscript review completion, recommendation confirmation, PDF signing, draft mutations, rubric scoring, final evaluation locking, meeting joining, message sending or result release.
- Respect unsaved evaluation warning before navigation; if a tour crosses routes and unsaved changes exist, pause and ask rather than discarding edits.
- Do not modify business rules, scoring algorithms, rubric templates, grades, published results, research data, permissions, TAM questionnaire/consent/responses or production records.

## 9. QA and evidence requirements

Use `roles/panelist/PANELIST_ACCEPTANCE_MATRIX.md` for statuses and evidence. Key browser journeys:

1. Invitation: “Where is my panel invitation?” → correct real invite and pending/accepted state; no action submitted.
2. Session: “Where are the defense papers?” → published packet or honest unavailable state; no invented materials.
3. Evaluation: “How do I submit a final evaluation?” → actual mode-specific form, safeguards, draft/preview/lock explained; no final submission.
4. Results: “Where are my results?” → distinguish personal locked evaluation versus unreleased official decision.
5. Optimization: common navigation uses **0 LLM calls**, complex question uses only selected relevant context.
6. Appearance: floating assistant ON by default when not overridden, OFF persists, Guide remains.
7. Responsiveness: collapsed sidebar, desktop/mobile, light/dark, college theme, keyboard/focus, reduced motion, arrows reposition after page transition.
8. Security: multi-role/multi-college switching, permission mismatches and absence of unauthorized action IDs.

Run targeted tests, type checks, lint/build as supported in repo. Browser-test where tooling available. Record NOT TESTED if not executed. No commits/pushes/merges/deploys without approval.

## 10. Deliverable

Brief final report: baseline branch/SHA, audited flows, verified role routes, topics (`PN-01`–`PN-20`) and status, shared components reused, changed files, actual test commands/outcomes, screenshots if possible, token/LLM bypass measurements where available, unresolved matrix IDs and integration risks. Explicitly distinguish implemented/blocked/not tested. Do not restate this document at length.
