# Adviser implementation start prompt

Copy the following into the implementing Codex session:

```text
Implement only Adviser-specific Guide and Floating AI Assistant help for ADVISIO.
First read AGENTS.md, applicable nested instructions, and all five files in
docs/advisio-guide/: README_START_HERE.md, ADVISIO_GUIDE_PRODUCT_CONTRACT.md,
ADVISER_PHASE2_SPEC.md, ADVISER_ACCEPTANCE_MATRIX.md, START_PROMPT_FOR_CODEX.md.
Verify branch, full SHA, working tree, agreed shared base/documentation revision,
and actual shared Researcher infrastructure. Preserve uncommitted work.
Resolve the provisional spec's missing original handoff and shared-code gates
before implementation; report gaps and never invent missing features or APIs.
Extend shared components/interfaces; implement Adviser topics, contextual rules,
verified routes/selectors, tours, and tests only. Coordinate necessary shared
changes with the shared owner. Preserve the shared UX, preferences, privacy,
scope, token-efficiency rules, and existing Researcher/academic workflows.
Validate against the acceptance matrix; record actual tests, screenshots,
request/token measurements, deviations, and limitations. Do not mark unexecuted
checks PASS. Do not commit, push, merge, or deploy without user authorization.
```
