# TAM Guide-only scope

Application base: `4eb422422f7f4d5e30eea93f474ffd89b95881cc` (TAM), including the Researcher and Adviser Guide updates from `78211cc3e1e20328a8fb5cfde60ad68f8a9b5a21`.

The user explicitly requested removing AI from TAM while keeping the updated Guide and keeping AI on main. This TAM-only change overrides the Assistant UI/API requirements of the historical Guide product contract for this deployment. It does not change that contract's permissions or guidance safety rules.

- Preserve the Researcher and Adviser Guide drawer, contextual written help, search, walkthroughs, and all six workspace entry points. Keep the Researcher introduction at the beginning.
- Remove the floating Assistant, conversation UI, browser visibility control, provider service and Assistant API route from this branch.
- Keep Guide permission filtering and Taglish search in `packages/shared/src/guide-help.ts`, independent of AI. Adviser Settings help now points to the existing Appearance controls.
- Reserve space above the fixed evaluation controls in the mobile sidebar so Guide and Settings remain reachable.
- Do not change evaluation consent, questionnaires, sessions, scenarios, respondent data, deployment settings or migrations.
- Do not merge these removals into main. Main retains its Assistant implementation.

Verification uses unit tests and synthetic local browser fixtures. Live verification is limited to read-only health, entry page and public asset requests; it must not create a respondent session or submit a questionnaire.

## Local validation (November 7, 2026)

- Web suite: 570 tests in 70 files passed from `apps/web` with the repository Vitest config.
- Evaluation API suite: 33 tests in 8 files passed with mocked database access.
- Hosted evaluation configuration: 3 tests passed, including rejection of production database targets.
- Web TypeScript check and ESLint passed. API semantic type checking passed with declaration generation disabled for this local check only. The normal declaration portability check reports TS2742 references through the reused dependency junctions; no source or compiler settings were weakened to suppress it.
- Web production bundle and API build passed. Production bundles contain no Assistant launcher, preference switch or Assistant API route.
- Synthetic browser fixtures: 40 Guide scenarios and 4 evaluation entry/Guide/settings/completion scenarios passed, including desktop/mobile, 20 Adviser help topics, Researcher introduction placement, restricted/empty states and non-AI workspace tours.
- Evaluation gateway, entry form, consent copy, session handling, questionnaire flow, scenarios, database files and deployment settings have no changes against the recorded TAM base. Only evaluation CSS adds mobile sidebar clearance.

Remote CI/deployment and live-commit status must be checked separately after pushing; these local results do not establish a live deployment.
