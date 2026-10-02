CREATE TYPE "DefenseSessionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'DELIBERATION', 'COMPLETED');
CREATE TYPE "DefenseDecision" AS ENUM ('APPROVED', 'APPROVED_WITH_MINOR_REVISIONS', 'MAJOR_REVISIONS_REQUIRED', 'REJECTED');

CREATE TABLE "defense_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "research_id" UUID NOT NULL,
  "status" "DefenseSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "decision" "DefenseDecision",
  "venue" VARCHAR(200),
  "scheduled_start" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "started_by" UUID,
  "ended_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "released_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "defense_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "evaluations"
  ADD COLUMN "defense_session_id" UUID,
  ADD COLUMN "criteria_scores" JSONB,
  ADD COLUMN "remarks" TEXT,
  ADD COLUMN "integrity_hash" VARCHAR(64),
  ADD COLUMN "locked_at" TIMESTAMP(3);

DROP INDEX IF EXISTS "evaluations_template_id_research_id_evaluator_id_key";

CREATE INDEX "defense_sessions_research_id_status_idx" ON "defense_sessions"("research_id", "status");
CREATE INDEX "defense_sessions_status_started_at_idx" ON "defense_sessions"("status", "started_at");
CREATE INDEX "evaluations_defense_session_id_idx" ON "evaluations"("defense_session_id");
CREATE INDEX "evaluations_template_id_research_id_evaluator_id_idx" ON "evaluations"("template_id", "research_id", "evaluator_id");
CREATE UNIQUE INDEX "evaluations_defense_session_id_evaluator_id_key" ON "evaluations"("defense_session_id", "evaluator_id");

ALTER TABLE "defense_sessions" ADD CONSTRAINT "defense_sessions_research_id_fkey"
  FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_defense_session_id_fkey"
  FOREIGN KEY ("defense_session_id") REFERENCES "defense_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
