# Fresh account scenario

Every TAM evaluation role has a **Demo scenario → Fresh account** option. Existing scenarios and initial selections remain unchanged. When Fresh account is selected, changing Demo role keeps Fresh account selected. Switching back to another scenario restores that scenario's records.

Fresh means the initial state of this separate dataset. Returning to it does not erase anything you created there during the same evaluation session. A new evaluation session starts blank again.

| Role | Fresh starting state |
| --- | --- |
| Researcher | No project, group, enrollment, manuscript, grades or defense; researcher onboarding is not started. |
| Research Professor / Coordinator | No authored workflow/class, submissions, review assignments or messages. |
| Adviser | No assigned advisees, requests, manuscript reviews, consultations or messages. |
| Panelist | No defense or manuscript-review assignments, evaluations or results. |
| Dean | No research projects, pending signature requests, signed history or saved signature. College reference data and the five fictional role identities remain available. |

College, program, current academic year and research type are reference configuration. They are retained so native setup flows can be explored with the same academic identity. The existing Guide, official website link, consent requirement and Google Forms completion instructions remain available; AI is not introduced into TAM.

## Isolation and lifecycle

Fresh accounts use a second private dataset for each new evaluation workspace, derived from its validated server-generated ID. This prevents new users and later activity from mixing with the prepared sample projects. All five fresh identities share this dataset so a freshly created class or project can be explored in another authorized role. Native role and college authorization still applies.

The existing project allowlist remains unchanged for prepared scenarios. Fresh mode uses native authorization within its separate initially empty schema, so newly created projects remain accessible. Database clients are cached by dataset, preventing a pending normal request from lending its connection to fresh mode. Switching uses the existing token rotation and stream revocation. Both datasets follow the existing workspace expiration/cleanup lifecycle.

No migration file, database target, deployment setting, questionnaire or consent text changes. The new dataset is provisioned only through the existing evaluation-workspace lifecycle. Creating it adds one baseline schema and five fictional users to the setup for a new workspace. Previously opened/prepared workspaces do not receive new data retroactively; start a new evaluation session to see Fresh account after release. Older sessions continue to support their existing scenarios.

## Verification

- Evaluation tests use mocked database clients: fresh account provisioning for every supported program, five role identities, absent sample work, schema-ID validation, separate simultaneous clients, role/scenario switching, original-scenario preservation, provisioning and cleanup.
- Desktop/mobile synthetic browser checks cover all five empty dashboards, Guide access, the six-activity checklist, completion instructions and role/scenario switching.
- No database migration or database seed script was executed for these checks. Browser fixtures do not establish that a real hosted fresh dataset has been provisioned. Remote deployment and hosted workspace verification must be reported separately after an authorized release.

Local results: 570 frontend tests, 50 evaluation API tests and 3 hosted-configuration tests passed. Web type checking, affected frontend lint, web build and API build passed. API semantic type checking passed with declaration output disabled only for the local linked-dependency setup; no committed compiler setting was changed. Ten desktop/mobile browser cases passed, followed by five interactive local role switches and a return to the original sample scenario.
