# Optional snippet to MERGE into an existing AGENTS.md (do not overwrite one)

For tasks involving ADVISIO Guide, interactive tours or AI assistance:

- Read `docs/guide/ADVISIO_GUIDE_PRODUCT_CONTRACT.md` first.
- For Adviser Phase 2 also read `docs/guide/ADVISER_PHASE2_SPEC.md` and `docs/guide/ADVISER_ACCEPTANCE_MATRIX.md`.
- Reuse existing Guide and AI infrastructure; extend one role at a time.
- Validate actual routes, permissions, theme tokens, state and UI targets against the current branch.
- Treat `Show me` as a real anchored, safe tour; don't create a disconnected modal slideshow.
- Prefer deterministic answers for high-confidence navigation to avoid needless LLM calls.
- No automatically executed consequential actions, no sensitive research records in provider prompts by default.
- No changes to TAM data or unrelated dashboards; no push/deploy without explicit approval.
- Report actual test evidence and acceptance-matrix status.

**Note:** These are project-specific instructions, not a reason to override any existing safety, security, or development instructions in the repository. If these files are placed in another directory, update the paths accordingly.
