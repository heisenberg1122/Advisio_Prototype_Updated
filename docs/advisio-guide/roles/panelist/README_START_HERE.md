# ADVISIO — Panelist Guide & AI Assistant: Team Handoff

**Phase 3 — Panelist only** · Prepared November 7, 2026. This is a source-based handoff spec, not a claim that the implementation is already present or tested.

## What's in the folder

| File | Purpose |
| --- | --- |
| `ADVISIO_GUIDE_PRODUCT_CONTRACT.md` | Shared UX/AI/security/efficiency contract, adapted from previous Adviser handoff (reconcile with newer committed version) |
| `roles/panelist/PANELIST_PHASE3_SPEC.md` | Detailed Panelist task flows and behavior, including invitations, defense packets and evaluation modes |
| `roles/panelist/PANELIST_ACCEPTANCE_MATRIX.md` | PASS/FAIL/BLOCKED/NOT TESTED evidence checklist |
| `roles/panelist/START_PROMPT_FOR_CODEX.md` | One short reusable Codex instruction that references these files |
| `roles/panelist/OPTIONAL_AGENTS_MD_SNIPPET.md` | Minimal pointer to add to an existing AGENTS.md, if appropriate |
| [Guide screenshots](../adviser/visual_anti_examples/) | Examples of layouts to avoid |

## Correct setup

1. Main developer agrees with the teammate on the **exact shared base SHA** containing the Researcher shared Guide/AI foundation. An Adviser implementation may or may not have been merged; it is not a prerequisite unless it contains shared fixes.
2. Put the shared product contract in `docs/advisio-guide/` and Panelist phase files in `docs/advisio-guide/roles/panelist/`. This avoids collisions with other role handoffs. If `ADVISIO_GUIDE_PRODUCT_CONTRACT.md` already exists, **keep the newer approved source** and reconcile differences rather than overwriting.
3. Record `git status --short`, `git branch --show-current`, `git rev-parse HEAD`; ensure no uncommitted changes are silently discarded.
4. Start an isolated Panelist feature branch from that exact commit. Work within `/panelist` plus role-specific help registry/tours. Coordinate any shared component changes.
5. Start Codex with the text in `START_PROMPT_FOR_CODEX.md`. This is intentionally short because the specification already contains detailed requirements.
6. Implement and test actual user flows, including both PDF and structured evaluation modes where test fixtures exist. Mark unavailable test states honestly.
7. Report evidence in the acceptance matrix and submit changes for code review. **Do not push, merge, deploy or commit without your team's explicit permission.**

## Reality check

The Panelist code inspected in the repository contains a general reviewer-assignment workspace plus a distinct defense packet review workflow, and multiple defense evaluation UI paths. A generic tour that treats these as one page is incorrect. Check the active source at implementation time before adding guides.

**Same prompt is not enough:** repeatability comes from identical code SHA, shared components, documented acceptance tests, review of screenshots, and consistent role/college security—not from identical prose or model settings alone.
