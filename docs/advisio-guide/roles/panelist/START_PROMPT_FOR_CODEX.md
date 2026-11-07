# Copy-ready Codex prompt — ADVISIO Phase 3: Panelist

Implement **ADVISIO Phase 3 — Panelist Guide & AI Assistant** using our existing shared Researcher Guide/AI infrastructure. **Read first, in order:**

1. `docs/advisio-guide/roles/panelist/README_START_HERE.md` (or this handoff README)
2. `docs/advisio-guide/ADVISIO_GUIDE_PRODUCT_CONTRACT.md`
3. `docs/advisio-guide/roles/panelist/PANELIST_PHASE3_SPEC.md`
4. `docs/advisio-guide/roles/panelist/PANELIST_ACCEPTANCE_MATRIX.md`

Treat the documents as the implementation contract, reconciled with any newer approved team documentation, AGENTS.md, and the actual repository code. Do not replace existing shared files blindly.

**Preflight:** run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`. Verify that the SHA matches the main developer's agreed shared baseline, and that the shared Guide drawer, tour engine, AI routing/backend, settings persistence and action registry exist. If anything differs, document the smallest dependency/blocker; don't create competing UI/backend. Work on a separate Panelist feature branch with no accidental carry-over.

**Scope:** Panelist only. Add role-specific natural-language topics, contextual Guide help, complete anchored-arrow walkthroughs, valid navigation actions, and appropriate floating Assistant suggestions. Priority flows: defense invitation/schedule → session workspace → defense review packet or general manuscript review (distinct) → appropriate configured evaluation form (structured/PDF/other supported) → private draft versus confirmed final lock → personal completed evaluation versus released official result. Support empty, pending, non-LIVE, permission-restricted, locked and multi-college states. Do not invent records or UI. No actual accepting, sharing, signing, submitting, scoring, locking, releasing or message sending during tours.

**Reuse/efficiency:** use shared components and authenticated provider, validated role+college action allowlist, deterministic FAQ-first responses (0 LLM calls for simple navigation), minimal bounded AI context for complex queries; no new generic chatbot, large prompt ingestion, duplicative model calls or sending private academic records to model by default. Maintain polished nonblocking Guide drawer, optional floating button default ON when unset and OFF persisted, accurate connected arrows and responsive light/dark UI.

**Verification:** complete `PANELIST_ACCEPTANCE_MATRIX.md` with actual browser and test evidence; prioritize the five golden flows. Run appropriate automated tests/typecheck/build; mark unavailable/untested cases truthfully. Report branch/SHA, changed files, topic coverage, provider bypass, test results and blockers concisely. Preserve Researcher/Adviser functionality and all TAM data. **Do not commit, push, merge or deploy without authorization.**
