ALTER TABLE "workflows" ADD COLUMN "availability_mode" VARCHAR(24) NOT NULL DEFAULT 'LEGACY_SEQUENCE';
ALTER TABLE "workflow_stages" ADD COLUMN "captures_research_title" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "milestone_prerequisites" (
  "stage_id" UUID NOT NULL REFERENCES "workflow_stages"("id") ON DELETE CASCADE,
  "prerequisite_id" UUID NOT NULL REFERENCES "workflow_stages"("id") ON DELETE RESTRICT,
  PRIMARY KEY ("stage_id", "prerequisite_id"),
  CHECK ("stage_id" <> "prerequisite_id")
);
CREATE INDEX "milestone_prerequisites_prerequisite_id_idx" ON "milestone_prerequisites"("prerequisite_id");

CREATE TABLE "project_milestone_states" (
  "research_id" UUID NOT NULL REFERENCES "research_projects"("id") ON DELETE CASCADE,
  "stage_id" UUID NOT NULL REFERENCES "workflow_stages"("id") ON DELETE RESTRICT,
  "decision" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  "generation" INTEGER NOT NULL DEFAULT 0,
  "approval_basis" JSONB NOT NULL DEFAULT '{}',
  "revision_task_ids" JSONB NOT NULL DEFAULT '[]',
  "reopened_at" TIMESTAMP(3),
  "reason" TEXT,
  "proposed_title" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("research_id", "stage_id")
);
CREATE INDEX "project_milestone_states_stage_id_idx" ON "project_milestone_states"("stage_id");

CREATE TABLE "milestone_decision_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "research_id" UUID NOT NULL REFERENCES "research_projects"("id") ON DELETE CASCADE,
  "stage_id" UUID NOT NULL REFERENCES "workflow_stages"("id") ON DELETE RESTRICT,
  "actor_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decision" VARCHAR(30) NOT NULL,
  "generation" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "milestone_decision_events_research_id_stage_id_created_at_idx"
  ON "milestone_decision_events"("research_id", "stage_id", "created_at");

-- Approval events are append-only. Historical approvals remain evidence when
-- a current group milestone is reopened or reconfirmed.
CREATE FUNCTION prevent_milestone_decision_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Milestone decision history cannot be rewritten';
END;
$$;
CREATE TRIGGER milestone_decision_history_immutable BEFORE UPDATE ON "milestone_decision_events"
FOR EACH ROW EXECUTE FUNCTION prevent_milestone_decision_rewrite();

-- No approvals are inferred from stage sequence. Legacy evidence is evaluated
-- per project until the first explicit decision captures its approval basis.
