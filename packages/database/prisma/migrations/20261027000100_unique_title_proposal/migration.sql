CREATE UNIQUE INDEX "workflow_stages_one_title_proposal_per_workflow" ON "workflow_stages" ("workflow_id") WHERE "milestone_type" = 'TITLE_PROPOSAL';
