# ADVISIO Guide & AI Assistant — Product Contract

**Version 1.0 — shared rules across Researcher, Adviser, and later role phases.** Adviser-specific behavior is in `ADVISER_PHASE2_SPEC.md`.

## Product purpose and priority

Users reported low perceived ease of use and confusion about how the app works. The solution must help a person **find a feature, understand its purpose, and safely complete a task**. Prioritize: (1) accuracy and permissions, (2) useful guided task completion, (3) clear conversational UX, (4) visual polish/accessibility, (5) reasonable token and runtime cost.

## UI contract

| Surface | Must do | Must not do |
| --- | --- | --- |
| Sidebar | Label **Guide** with clear icon immediately **above Settings** (then Sign Out) | Rename it back to Take a Tour or bury it in Settings |
| Guide launcher | Nonblocking right-side drawer, approx. 380–420px desktop; page stays visible; responsive mobile panel | Heavy blur/dim, oversized centered modal, giant flat feature list |
| Guide home | Current-page help; popular **How do I…?** questions; searchable topics; optional **Start tour** inside Guide | Launch tour immediately just by opening Guide |
| Walkthrough | Precise anchor, short conversational tooltip, connected arrow/leader line, working **Show me**, Back/Exit/Next where needed | Arrow pointing to empty space; full-sidebar highlight for a single action; generic disconnected slideshow |
| AI launcher | Small floating button, initially visible for eligible new accounts; chat panel stays closed until clicked | Auto-open chat, proactive model calls on page load, intrusive animations |
| AI panel | Conversational responses, optional **Show me**, **Take me there**, **Open Guide** actions | Pretend to take actions it did not take or invent routes |
| Settings | **Show floating AI Assistant** switch; default ON only when no saved choice; OFF hides button; Guide remains | Re-enable an explicit OFF setting or leak account preferences |

### Suggested Guide visual hierarchy (not a pixel-perfect mockup)

```text
┌──────────────────────────────────────────┐
│ 📖 Guide                    Adviser  ×   │
│ What can we help you with?               │
│ [ Search e.g. “review a manuscript”   ]  │
│                                          │
│ On this page                             │
│ [ Need help with Reviews?  Show me → ]   │
│                                          │
│ Popular questions                        │
│ > Where are my advisees?                 │
│ > How do I review a manuscript?          │
│ > How do I schedule a consultation?      │
│                                          │
│ Browse topics                            │
│ > Advisees & requests                    │
│ > Reviews & feedback                     │
│ > Progress & consultations               │
│                                          │
│ ─────────────────────────────────────    │
│ 🧭 Explore workspace       Start tour →  │
└──────────────────────────────────────────┘
```

Do not force all sections into a tiny viewport; allow inner scrolling without a nested-scroll mess. Maintain the important entry points above the fold on a normal desktop display.

## Guidance copy contract

- Short, natural, professional and task-oriented; no robotic “Navigate to...” narration.
- One topic per step; usually one or two short sentences, but provide enough detail for complex tasks.
- *Where*, *what happens*, and *what next* are more useful than naming a page.
- Example **good**: “Ready to review a manuscript? Your assigned reviews are here. Open one and I'll show you the tools.”
- Example **bad**: “Navigate to the Review Workspace. You can manage all manuscript reviewing functionality here.”
- Questions must use users' language, not only internal labels; tolerate English and common Taglish phrasings where supported.
- Explain empty states and permission restrictions instead of claiming records or controls exist.

## Walkthrough and navigation behavior

- All app actions are selected from a **verified role-aware allowlist** of routes/help topics/walkthrough IDs.
- Navigate with app router and preserve current authorized college, workspace, and project context.
- `Show me` must highlight a **real, rendered element** using stable identifiers, position a tooltip by that element, and optionally let the user click safely.
- Expand hidden/collapsed navigation before selecting a target. Recalculate arrow after route transitions, scroll, viewport changes, and async loads.
- If target missing: wait reasonably for loading, then explain and provide an exit/recovery path. **Never show a floating disconnected arrow.**
- Do not perform consequential writes during a guide: review decisions, approvals, requests, scheduling, emails, edits or deletion.
- Guides remain available without the AI assistant. Avoid duplicate topic registries that drift apart.

## AI routing and token/cost contract

1. **Deterministic first:** search a verified FAQ/navigation registry by high-confidence intent, synonyms, role and state; answer without LLM whenever appropriate.
2. **Authorized state second:** inspect minimal relevant permitted state if needed (e.g. request/review status). If factual data explains it, do not waste an LLM call.
3. **AI only when useful:** for ambiguous/multi-step reasoning, pass only concise system rules, active role, current page, a small set of relevant vetted help entries, minimal non-sensitive state, and limited essential conversation history.
4. **Output sizing:** simple responses ~1–3 sentences + valid action; longer only when genuinely helpful. Never truncate critical conditions merely to hit a token quota.
5. **Operations:** one model call rather than model-based classify+rewrite chains; avoid unnecessary retries, broad tool scans, embeddings/vector DB without measured need. Reuse shared authenticated backend/provider.
6. **Metrics:** count registry vs AI responses, provider-reported input/output tokens when available, response time/errors. Cache only safe non-sensitive shared help; never globally cache private adviser/student data.

Do not use a fragile hardcoded exact-word matcher that fails obvious paraphrases. Route ambiguous or low-confidence questions to a clarification or model rather than a wrong deterministic answer.

## Privacy and authorization contract

- Active workspace + active approved college must control help eligibility and actions; first role on account is insufficient.
- Unauthorized routes/actions are never emitted as executable suggestions; UI authorization must also be checked server-side for any data reads.
- Never send private manuscripts, grades, reviews/comments, messages, passwords, or personal student records to external AI by default.
- Provider calls must be authenticated, rate-limited, bounded, and protected against prompt injection. Keep keys server-side.
- If AI unavailable: Guide continues to work; show truthful fallback.
- Default floating visibility for new eligible accounts is ON **only when no preference has been saved**. Respect the established shared account-wide or explicitly role-scoped preference model.

## Invariants and boundaries

- Phase 2 = Adviser content only. Shared component bug fixes are allowed when strictly necessary; no premature rollout to other roles.
- Do not alter questionnaire/consent/collected TAM data, unrelated dashboards, permissions or research business rules.
- No commit, push, merge or deployment without explicit authorization.
- Avoid claiming an actual test passed unless it was run. Surface blockers and failed scenarios clearly.

## Visual anti-examples

See `visual_anti_examples/old_guide_modal_avoid.png` and `visual_anti_examples/old_tour_avoid.png` for undesirable states (obstructive modal, generic disconnected tour). **They are not desired mockups**. Use existing Advisio styling and its college/dark-mode tokens for the actual UI.
