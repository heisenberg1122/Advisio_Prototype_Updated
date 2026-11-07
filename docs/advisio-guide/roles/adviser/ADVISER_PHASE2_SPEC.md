# ADVISIO — Phase 2 Adviser Implementation Specification

**Scope:** `/adviser` workspace only. **Dependency:** working shared Guide + AI Assistant from Researcher phase. **Priority:** task-specific, real, role-safe help (not a shallow sidebar tour).

## 1. Inspection targets and known routes

Start with actual running branch; confirm all references before coding:

| Feature | Known route / location | Required assistant behavior |
| --- | --- | --- |
| Overview | `/adviser/dashboard` | Explain what the dashboard shows; prioritize next actions |
| My Advisees | `/adviser/dashboard?tab=advisees` | Find assigned groups and open one |
| Group supervision | `/adviser/advisees/[researchId]` | Group members, documents, activity, milestones, reviews, consultations |
| Reviews | `/adviser/reviews` | Open assigned manuscript/version, inspect feedback, explain decision choices |
| Official Copies | `/adviser/documents?tab=official` | Distinguish official copies from editable/submitted manuscripts |
| Consultations | `/adviser/dashboard?tab=consultations` | Locate scheduling, pending requests, notes/history where implemented |
| Calendar | `/adviser/calendar` | Find schedules and dates, don't invent meetings |
| Messages | `/adviser/dashboard?tab=group-chats` | Distinguish group messages from Inbox |
| Inbox | `/adviser/inbox` | Find faculty correspondence |
| Settings | `/adviser/settings` | Theme, preference for floating assistant |

Useful files: `AdviserSidebar.tsx`, `AdviserTopbar.tsx`, `adviser/dashboard/page.tsx`, `adviser/advisees/[researchId]/page.tsx`, `adviser/reviews/page.tsx`, `ManuscriptReviewWorkspace.tsx`, `AdviserResearchGroupCard.tsx`, existing Guide and Account Settings components.

**Do not assume** all listed internal controls or status meanings are available in the target branch. Verify against rendered UI and current permissions; omit/mark unsupported actions instead of faking them.

## 2. Guide home and chatbot behavior

Guide header: **Guide · Faculty Adviser Workspace**. Search placeholder: `Try “How do I review a manuscript?”`. Current-page suggestion updates on navigation. Categories: **Getting started**, **Advisees & requests**, **Reviews & feedback**, **Progress & consultations**, **Communication & account**. The optional workspace tour lives inside Guide, not as the sidebar item itself.

AI launcher: **Advisio Assistant · Faculty Adviser**. New-account visibility defaults ON, chat initially closed; visibility off in Settings. Suggested questions: “Where are my advisees?”, “How do I review a manuscript?”, “How do I respond to an adviser request?”, “How do I schedule a consultation?”. Reuse same validated action IDs and backend as Researcher; no separate adviser AI API.

## 3. Required task guides and genuine outcomes

Each question needs: intent/synonyms, short verified answer, authorization/state prerequisites, actual route, `Show me` targets and arrow placement, safe click sequence, empty/unavailable fallback, and tests. Reuse the shared help registry schema; do not invent a second parallel help system.

| ID | User question / task | Required walkthrough outcome | Sensitive boundary / state |
| --- | --- | --- | --- |
| AD-01 | “Where can I find my advisees?” | Highlight My Advisees, open list, select an authorized group, highlight its overview | No group state; don't invent cards |
| AD-02 | “How do I open a group's workspace?” | Enter `/adviser/advisees/[researchId]` via valid group card and inspect members/documents/activity | Current college + group membership |
| AD-03 | “Did a group request me?” | Find actual pending adviser requests and status; explain pending vs assigned | No request state |
| AD-04 | “How do I accept/decline a request?” | Explain and point to decision controls; stop before actual response | Respect capacity; no automatic accept/decline |
| AD-05 | “Why can't I accept another group?” | Show verified reason if known; otherwise navigate to capacity/request details | Never guess limit or status |
| AD-06 | “Where are my assigned manuscripts?” | Go to `/adviser/reviews`, highlight active assignment and document version | No assignments; completed/revoked differences |
| AD-07 | “How do I review a manuscript?” | Open active assignment, inspect snapshot, feedback fields, version history, decision controls | No review submission during tour |
| AD-08 | “What do review choices mean?” | Explain **Approve version / Minor revision / Major revision / Reject version** using actual system states | Do not invent academic policy |
| AD-09 | “Where are previous versions?” | Open available history and differentiate current assigned version | Do not imply comments carry over |
| AD-10 | “Why can't I review this?” | Distinguish `ACTIVE`, `COMPLETED`, `REVOKED`, `REASSIGNED`, `SUPERSEDED`, restricted/missing versions if exposed | Check actual assignment state |
| AD-11 | “How is my group progressing?” | Inspect authorized group milestones, pending tasks, and project activity | Incomplete ≠ overdue without evidence |
| AD-12 | “How do I approve a milestone?” | Locate eligible milestone and explain controls; no actual approval | Only if available/authorized |
| AD-13 | “How do I schedule a consultation?” | Navigate to Consultations, highlight group/topic/date/time, explain expected result | Do not create actual meeting |
| AD-14 | “Where are consultation requests/notes?” | Explain request statuses, recorded history/notes, relevant actual controls | No invented transcripts |
| AD-15 | “How do I start a video consultation?” | Show real Meet/session action, only if accessible and configured | No fake link or launch claim |
| AD-16 | “Where are finalized documents?” | Show Official Copies and explain difference from review assignments | Respect view/download permissions |
| AD-17 | “How do I message an advisee?” | Explain Group Messages vs Inbox with correct authorized destination | Do not send message |
| AD-18 | “How do I change theme/college?” | Point to topbar/settings theme; active-college switch in profile where permitted | Theme ≠ college; college access scope |
| AD-19 | “How do I hide the Assistant?” | Settings → Appearance → Workspace Assistance; switch visibility OFF; Guide remains | Preserve saved OFF across sessions |

## 4. Workspace introduction — coherent narrative

Tour should feel like a human colleague helping, not a list of nav labels. Suggested progression; adapt to actual UI/data:

1. “Let's see what's happening with your advisees.” → overview and any actionable activity.
2. “Your assigned groups are here. Open one when you're ready.” → My Advisees.
3. “This is a group's workspace: members, documents and progress live together.” → authorized group page.
4. “Assigned manuscripts need your review here.” → Reviews, current assignment or empty state.
5. “New groups may send adviser requests. You can look before deciding.” → actual request area (if present).
6. “Use progress and milestones to see what remains.” → group progress, safe read-only view.
7. “Consultations let you plan advising time.” → consultation controls, no submission.
8. “Need the full process later? Open Guide or ask Advisio Assistant.” → finish.

No arbitrary four-step cap; also do not force every subfeature into the introductory tour. Use optional task guides for detail.

## 5. Content and AI examples

| User input | Helpful response shape | Action |
| --- | --- | --- |
| “Where's my research group?” | “Your assigned groups are in My Advisees. Open one to see its members, research files and progress.” | Show me → AD-01 |
| “What does major revision mean?” | Brief explanation based on actual review control semantics; don't invent institution policy | Open Guide → AD-08 |
| “I can't review this version” | Inspect authorized assignment status; if unknown, say so and show review history | Show me → AD-10 |
| “Set a meeting with the group” | “You can plan a consultation from Consultations. I'll show you where the schedule controls are.” | Show me → AD-13 |
| “Why won't it accept another group?” | Check actual adviser capacity/request state; do not fabricate cause | State-aware AD-05 |

Simple known navigation answers should bypass the model. For ambiguous or complex questions, use the shared authenticated AI backend, limited vetted context and safe action IDs. No manuscript bodies, student private data or full historical logs in AI prompts by default.

## 6. State and scope matrix

Test at least: 0 advisees, multiple advisees, no pending request, pending request, full capacity (if supported), active review, completed review, revoked/superseded review, missing version, no consultation, scheduled consultation, external meeting integration unavailable, Adviser plus Panelist roles, two authorized colleges. Switching role/college must invalidate an incompatible guide without revealing restricted data.

## 7. Specific acceptance outcome

A first-time Adviser should be able to open **Guide**, ask *“How do I review a manuscript?”*, receive a correct short answer, press **Show me**, navigate to the actual Review workspace, find an active assigned version or understand why none appears, inspect the relevant review tools safely, and exit without having submitted a decision. The same flow should be available from the floating assistant, with no additional model call when registry information is sufficient.

See `ADVISER_ACCEPTANCE_MATRIX.md` for test evidence and stop conditions.
