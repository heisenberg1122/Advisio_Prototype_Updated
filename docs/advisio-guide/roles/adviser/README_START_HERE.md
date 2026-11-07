# ADVISIO — Adviser Guide & AI Assistant Handoff

**Handoff version:** 1.0 · **Date:** 2026-11-07 · **Phase:** 2 — Adviser only

This packet gives a teammate the same **requirements, constraints, visual direction, and proof-of-completion criteria** used for the Advisio assistance work. It cannot guarantee identical code or pixel-perfect results across developers/models, but it makes results testable and much less dependent on interpretation.

## Files and reading order

| File | Purpose | Read when |
| --- | --- | --- |
| `README_START_HERE.md` | Setup and collaboration process | First |
| [ADVISIO_GUIDE_PRODUCT_CONTRACT.md](../../ADVISIO_GUIDE_PRODUCT_CONTRACT.md) | Shared, non-negotiable design/AI/security rules | Before implementation |
| `ADVISER_PHASE2_SPEC.md` | Adviser-only task flows, routes and required states | Before implementation |
| `ADVISER_ACCEPTANCE_MATRIX.md` | Concrete pass/fail evidence required | During and after implementation |
| `START_PROMPT_FOR_CODEX.md` | Short instruction to paste into Codex | At task start |
| `visual_anti_examples/` | Screenshots of **what to avoid**, NOT desired UI | For visual QA |

## Set an identical code baseline first

Both developers must use the **same repository, same base branch, and same commit SHA**. A prompt alone cannot overcome different versions of the application.

Repository: `heisenberg1122/Advisio_Prototype_Updated`.

The project's previously discussed evaluation branch was `codex/qr-evaluation-local`, **but do not assume that this remains the working implementation branch**. The actual Guide/Assistant work may be on a newer branch. The teammate must obtain the *current branch name and HEAD SHA from the owner* and check out that exact state. Avoid copying uncommitted changes into a live or unrelated branch without coordination.

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -1 --format='%h %s'
```

Record the baseline in the table below **before coding**:

| Field | Value |
| --- | --- |
| Target repo | `heisenberg1122/Advisio_Prototype_Updated` |
| Base branch | main |
| Base commit SHA | 3e2902b73c59f2c5598fb7655c3039db41e01895 |
| Feature branch | codex/adviser-guide-phase2 |
| Researcher Guide / AI implementation present? | Verified: shared drawer, walkthrough, assistant endpoint and visibility preference |
| Package manager and test commands | npm workspaces; see the acceptance matrix for commands and evidence |

**Important:** Do not infer the development branch from a Render/Vercel service name. A deployment can point somewhere else.

## Teammate workflow

1. Copy this folder into the same repo as a temporary handoff or shared `docs/` reference. If there is an existing `AGENTS.md`, **do not overwrite it**; these files supplement repository instructions.
2. Open the correct repository and agreed working commit in Codex. Use the same model/thinking settings where available, but prioritize the shared spec and acceptance matrix over model sameness.
3. Paste `START_PROMPT_FOR_CODEX.md` as the initial task. Have Codex read the two specification documents and acceptance matrix from the local checkout.
4. Verify that the Researcher Guide / floating assistant infrastructure actually exists at that commit. Extend it; do not build a second UI/backend.
5. Work in an isolated feature branch. Do not push/deploy or alter live TAM collection without permission.
6. Before handoff, produce a short changed-file summary, **actual tests run**, a completed acceptance matrix, and desktop/mobile screenshots of the Adviser Guide and chat.
7. Compare the completed Adviser UI to the shared Product Contract and anti-examples. Fix failed acceptance items before considering the task complete.

## Golden design behavior (the shared mental model)

- **Guide** is in the sidebar **above Settings**, and opens a quiet, **nonblocking right-side drawer**.
- **Floating AI Assistant** is separate, visibly available by default for a new Adviser account (chat panel closed), and can be hidden in **Settings** without hiding Guide.
- Asking *“How do I review a manuscript?”* produces a useful answer and, when supported, **Show me**, which navigates to the real Reviews UI and highlights actual controls with an arrow.
- The tour is **not** a generic four-card slide show. It follows the adviser's work: groups → manuscript reviews → requests/progress → consultations.
- Simple, high-confidence navigation questions resolve from a verified registry with **zero paid model calls**. The AI handles only genuinely ambiguous or complex requests, using minimal relevant context.

## Team coordination / avoiding code conflicts

- Assign a clear owner for changes to shared Guide/AI infrastructure.
- The Adviser teammate should normally add Adviser definitions, targets, help topics, tests, and only targeted shared fixes.
- Do not merge independent changes to the same Guide registry without reviewing both branches.
- Do not claim parity if one branch has an incomplete Researcher assistant: document the dependency first.
- Keep the acceptance matrix in the pull request or handoff, with screenshots/test output.

## Boundaries

No changes to TAM survey forms/consent/response data, production research records, role authorization, review decisions, adviser capacity, or backend business rules. No automated accepting/declining requests, manuscript review submission, milestone approval, message sending, or consultation scheduling. No hardcoded model credentials or sending manuscripts/private messages to an AI provider by default.

**Success = repeatable evidence**, not merely two people copying the same prompt or getting visually similar screenshots.
