# Start here: ADVISIO Guide and AI Assistant development

This directory is the shared handoff for dashboard-specific Guide and Floating AI Assistant work. It contains requirements and a source inspection, not a completed Adviser implementation.

## Reference snapshot and readiness

| Field                                       | Reference                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Repository                                  | `heisenberg1122/Advisio_Prototype_Updated`                                          |
| Inspected branch                            | `codex/qr-evaluation-local`                                                         |
| Inspected application commit                | `b78a1196381d60b88e687c0b5db1cba3c80c2b9f`                                          |
| Inspection date                             | November 7, 2026 (Asia/Manila)                                                      |
| Working tree before this documentation task | Clean                                                                               |
| Shared product contract                     | Version 1.0, [ADVISIO_GUIDE_PRODUCT_CONTRACT.md](ADVISIO_GUIDE_PRODUCT_CONTRACT.md) |
| Adviser task source                         | [ADVISER_PHASE2_SPEC.md](ADVISER_PHASE2_SPEC.md), **provisional**                   |

The requested Researcher reference implementation is **not fully present at this commit**. There is a written/video Researcher walkthrough, shared navigation, appearance settings, and an unintegrated basic tour component. Source inspection found no floating assistant, assistant API, help registry, shared assistant action validator, Guide drawer, or Workspace Assistance preference. See the contract's evidence table for paths and limitations. These are source findings, not runtime test results.

The original detailed Adviser Guide/AI Phase 2 handoff was not found in the repository or supplied attachment. The existing Adviser video production plan is a useful workflow reference but is not that specification. **The original specification must be supplied and reconciled before Adviser implementation begins.** Do not present the provisional file as a reproduction of it.

The shared owner must also provide the intended Researcher implementation commit, or coordinate completion of the missing shared infrastructure in separate authorized work. The Adviser owner must not recreate these missing systems independently. Read-only planning and fixture design can proceed while these prerequisites are resolved.

## Reading order and authority

**Delivery synchronization:** before pushing this handoff, the branch advanced to `257b4257b1550d4b1cae5a8dd5e773b642f010c6`. The documentation commit was rebased onto that source without changing its application files. The inspection snapshot above remains historical. New source includes [WorkspaceHelp.tsx](../../apps/web/src/components/layout/WorkspaceHelp.tsx) (a Help & Guide modal with page context and links) and [workspace-guide.ts](../../apps/web/src/lib/workspace-guide.ts) (static role-specific steps/questions). Reuse and inspect these additions; do not treat all contextual help as absent. They do not establish a floating AI assistant or compliance with the required drawer/tour/API architecture. Re-audit the inventory, routes, and selectors against this delivery base before implementing.

1. [ADVISIO_GUIDE_PRODUCT_CONTRACT.md](ADVISIO_GUIDE_PRODUCT_CONTRACT.md): authoritative cross-role UX, architecture, privacy, preferences, and ownership.
2. [ADVISER_PHASE2_SPEC.md](ADVISER_PHASE2_SPEC.md): Adviser workflows, verified route references, and prerequisite gaps.
3. [ADVISER_ACCEPTANCE_MATRIX.md](ADVISER_ACCEPTANCE_MATRIX.md): measurable verification and evidence recording.
4. [START_PROMPT_FOR_CODEX.md](START_PROMPT_FOR_CODEX.md): short prompt for the implementing session.

The contract governs shared behavior. Once supplied, the original Adviser handoff governs substantive Adviser requirements; reconcile any conflict explicitly with the owners and update this package before implementation. Current source establishes what exists, not automatic compliance with the contract. Screenshots establish visual references only, not routes or permissions. Never invent missing features to reconcile a discrepancy.

## Team workflow

1. **Obtain the repository and agreed source.** Fetch through the team's normal authenticated workflow. Record `git branch --show-current`, `git rev-parse HEAD`, and `git status --short`. Compare local work before changing it. Confirm the repository remote. The application snapshot above does not include these newly written documents until the team shares or commits them.
2. **Read the contract.** Both developers must use the same contract version **and the same file content** from a recorded documentation commit. Matching a version label alone is insufficient.
3. **Read the role specification.** Resolve the missing original handoff and shared implementation gates above. Record any remaining decisions and their owners.
4. **Review the acceptance matrix.** Prepare synthetic, authorized Adviser accounts, two college scopes, multiple project states, review assignments/versions, and consultation states. Do not use production records or change TAM forms/responses.
5. **Create an isolated feature branch from the agreed shared base.** Record the full SHA; use a name such as `codex/adviser-guide-phase2`. Verify that it contains the approved shared infrastructure and documentation revision. Different branch names never guarantee identical source code. Avoid switching over uncommitted work.
6. **Implement only Adviser-specific changes.** Reuse the shared Guide, assistant, registry interface, validator, settings infrastructure, and tour engine. Coordinate necessary shared changes with the shared owner; document the reason and impact before integration.
7. **Run appropriate checks.** Use targeted tests, web type checking/build, and manual visual/accessibility checks appropriate to changed files. For API changes coordinated with the shared owner, include permission and scope tests. Record actual results, commands, commit, fixture, and limitations in the matrix. Do not run database reset/seed or evaluation scripts against production.
8. **Submit for review through the authorized team process.** Include changed files, evidence, screenshots at named viewport/theme settings, request/token measurements, and deviations. Commits, pushes, merges, and deployments require the user's authorization; this documentation task grants none.
9. **Compare with the shared contract before merging.** Shared owner reviews shared code; Adviser owner reviews role content and tests. Re-run affected checks after integration. After any authorized push, follow [AGENTS.md](../../AGENTS.md): inspect GitHub Actions and deployment results for the exact pushed commit and report them separately from local results.

## Ownership and coordination

| Owner                        | Responsibility                                                                                                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared infrastructure owner  | Guide UI; floating assistant UI; AI API/request routing; shared navigation/action validation; tour engine/spotlight geometry; settings preference storage/defaults; shared knowledge registry interfaces; cross-role regression checks. |
| Adviser implementation owner | Adviser help entries; role-specific walkthrough definitions; navigation mappings; contextual state rules; Adviser fixtures and test cases using shared interfaces.                                                                      |
| Both owners                  | Agree on shared base/documentation revision; reconcile the original handoff; review cross-role behavior and deviations before integration.                                                                                              |

Record the named shared owner and Adviser owner in the implementation review. An unassigned shared prerequisite remains blocked. Do not let two sessions build competing drawers, assistants, APIs, preference keys, or tour engines. Changes to shared infrastructure must be necessary, documented, and coordinated with its owner. Permissions and academic backend changes are outside this role-help task.

## Consistency across Codex sessions

At the start of each session, record the application base SHA, current SHA, documentation commit, contract version, and working-tree status. Inspect the actual shared components before editing. Verify routes, query parameters, selectors, authorized states, and reusable visual tokens against that checkout. Use the same approved screenshots where available, with their commit, viewport, college theme, and display mode recorded. The repository's walkthrough videos/posters can illustrate workflows; they are not an approved compact Guide/assistant design reference.

Use the Researcher behavior from the supplied shared implementation as the reference after its source is verified. Preserve its established behavior where compatible with this contract. Report conflicts and deviations explicitly; do not silently change the Researcher implementation. Shared code, contracts, review, and measured tests create consistency. Identical prompts alone cannot promise pixel-identical results.

## Maintaining this snapshot

When shared implementation changes, update the full application SHA in this README and the contract together. Review the inventory, Adviser routes, readiness gates, and acceptance criteria against that SHA; revise the contract version when shared requirements change. Record the documentation delivery commit separately in the handoff/review so the documents do not need to contain their own commit hash. Both developers must acknowledge the new base and documentation revision before continuing.

Do not substitute a branch name, a successful push, or a passing local build for a verified source commit, passing remote checks, or a completed deployment.

## What to send the groupmate

Send the **entire `docs/advisio-guide/` directory** together with the updated root `AGENTS.md`, the approved shared application base SHA, the documentation delivery commit (or these exact files if still uncommitted), the named owners, and the original detailed Adviser handoff. Copy the prompt from [START_PROMPT_FOR_CODEX.md](START_PROMPT_FOR_CODEX.md) into their Codex session. At this snapshot, communicate the missing original specification and shared assistant implementation first; the groupmate should audit prerequisites before implementing.
