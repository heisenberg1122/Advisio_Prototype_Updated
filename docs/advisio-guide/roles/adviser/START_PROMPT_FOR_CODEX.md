# Copy/paste this prompt into your teammate's Codex session

You are implementing **ADVISIO Phase 2 — Faculty Adviser Guide & AI Assistant**, extending (not rebuilding) the existing Researcher assistance system.

**Read these local files before changing code, in this order:**

1. `README_START_HERE.md`
2. `../../ADVISIO_GUIDE_PRODUCT_CONTRACT.md`
3. `ADVISER_PHASE2_SPEC.md`
4. `ADVISER_ACCEPTANCE_MATRIX.md`

Use these documents as the **authoritative implementation contract** for this task, subject to repository-level instructions and real code behavior. The pasted prompt alone is intentionally brief to avoid repeating thousands of tokens.

**Preflight:** run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, and report the base branch/SHA. Verify it matches the branch and commit agreed by the team. Confirm whether the shared Guide drawer, tour registry, AI endpoint, and floating assistant from the Researcher phase actually exist. If the baseline is wrong or shared dependency is missing, report the discrepancy rather than creating a competing implementation. Preserve existing work and do not discard uncommitted changes.

**Scope:** Adviser (`/adviser`) only. Build/extend Adviser-specific help topics, conversational walkthroughs, real anchored arrow targets, contextual Guide content and role-aware AI responses; reuse existing shared components and AI backend. Give priority to My Advisees, the group supervision workspace, manuscript versions/review decisions, adviser requests/capacity, consultations, and Official Copies. Use only verified routes and permitted interactions; handle empty and unavailable states.

**Quality:** Follow the shared Product Contract exactly. The Guide opens a nonblocking drawer, the AI button is default-visible when no OFF preference exists, and **Show me** must navigate to real controls, not display a generic modal. No automatic review submission, adviser request acceptance, meeting scheduling, or other consequential action. No cross-college or cross-role information leaks. Maintain deterministic registry answers with 0 LLM calls for simple high-confidence navigation; only use model calls for ambiguity/complex help with minimal relevant context.

**Working method:** inspect targeted files, make minimal maintainable changes, and verify the flow in a browser when possible. Implement as completely as the actual codebase allows; explicitly report blocked items. Do not change unrelated dashboards, TAM responses/forms, backend business rules, or production data. Do not commit, push, merge or deploy unless separately authorized.

**Deliverable:** an updated `ADVISER_ACCEPTANCE_MATRIX.md` with evidence for each applicable item, exact test commands/results, screenshots when available, modified-file list, and a concise summary of remaining gaps. The task is not complete merely because the build passes.
