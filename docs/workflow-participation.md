# Starting research workflows before title registration

Researchers can join a published workflow and start its available milestones without registering a research title. Each department determines the milestone order: adviser selection, title proposals, or document work may come first.

## Researcher flow

1. Join the professor's workflow from Tasks & Requirements.
2. Open an available milestone and choose Start this milestone. Choose an existing workspace or work individually.
3. Complete the milestone: send an adviser request, submit proposed titles, or work on a document.
4. If the workflow contains Title Proposal, the professor selects a title to register the research project. Otherwise, the leader can add the research title through My Project when the department requires it.

Starting creates an untitled participation record, with `workflowDraft=true`, behind the existing project-owned storage APIs. It is excluded from the professor's Research Projects list until registration. Title registration promotes the same record; adviser requests, members, files, submissions, and workflow progress retain their IDs.

## Access and ordering

- Active workflow enrollment and the researcher's academic program are checked on the server.
- Workspaces require active membership. A group uses one record per workflow, and its existing leader must be enrolled.
- Only group leaders can send adviser requests or submit title proposals.
- Required milestone conditions and earlier approval gates still block unavailable work.
- Starting a workflow does not restore removed enrollment or automatically publish workflows.
- Completing the currently configured milestones does not close an untitled participation as a completed research project. Later published milestones reopen its workflow.

## Database rollout

Apply migrations through `20261027000200_workflow_participation` before running this version. Existing projects default to `workflowDraft=false`. The preceding Title Proposal migrations are also required.

The isolated lifecycle integration tests cover adviser-first, title-first, document-first, concurrent group starts, and preserving records through registration. They use the repository's dedicated-database identity guards and clean up their fixtures.
