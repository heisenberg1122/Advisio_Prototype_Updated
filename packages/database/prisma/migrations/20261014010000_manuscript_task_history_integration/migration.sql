-- Phase 5: immutable task-attempt history and idempotent workflow notifications.
-- TaskSubmission remains the backward-compatible current summary. Each new
-- formal manuscript submission is additionally retained as an exact attempt.

ALTER TABLE "notifications"
  ADD COLUMN "deduplication_key" VARCHAR(191),
  ADD COLUMN "action_url" VARCHAR(500);

CREATE UNIQUE INDEX "notifications_deduplication_key_key"
  ON "notifications"("deduplication_key");

CREATE TABLE "task_submission_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "task_submission_id" UUID NOT NULL,
  "research_id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "milestone_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "submitted_by" UUID NOT NULL,
  "status" "TaskSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "note" TEXT,
  "review_note" TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_submission_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_submission_attempts_attempt_number_check"
    CHECK ("attempt_number" > 0)
);

CREATE UNIQUE INDEX "task_submission_attempts_task_submission_id_attempt_number_key"
  ON "task_submission_attempts"("task_submission_id", "attempt_number");
CREATE UNIQUE INDEX "task_submission_attempts_task_submission_id_document_version_id_key"
  ON "task_submission_attempts"("task_submission_id", "document_version_id");
CREATE INDEX "task_submission_attempts_research_id_milestone_id_submitted_at_idx"
  ON "task_submission_attempts"("research_id", "milestone_id", "submitted_at");
CREATE INDEX "task_submission_attempts_task_id_status_idx"
  ON "task_submission_attempts"("task_id", "status");
CREATE INDEX "task_submission_attempts_document_version_id_idx"
  ON "task_submission_attempts"("document_version_id");
CREATE INDEX "task_submission_attempts_submitted_by_idx"
  ON "task_submission_attempts"("submitted_by");

ALTER TABLE "task_submission_attempts"
  ADD CONSTRAINT "task_submission_attempts_task_submission_id_fkey"
  FOREIGN KEY ("task_submission_id") REFERENCES "task_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "task_submission_attempts_research_id_fkey"
  FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "task_submission_attempts_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "workflow_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "task_submission_attempts_milestone_id_fkey"
  FOREIGN KEY ("milestone_id") REFERENCES "workflow_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "task_submission_attempts_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "task_submission_attempts_document_version_id_fkey"
  FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "task_submission_attempts_submitted_by_fkey"
  FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve already exact-linked current submissions as attempt 1. Legacy
-- summaries without an exact version remain untouched instead of guessing.
INSERT INTO "task_submission_attempts" (
  "task_submission_id",
  "research_id",
  "task_id",
  "milestone_id",
  "document_id",
  "document_version_id",
  "attempt_number",
  "submitted_by",
  "status",
  "note",
  "review_note",
  "submitted_at",
  "reviewed_at",
  "created_at",
  "updated_at"
)
SELECT
  submission."id",
  submission."research_id",
  submission."task_id",
  task."stage_id",
  submission."document_id",
  submission."document_version_id",
  1,
  submission."submitted_by",
  submission."status",
  submission."note",
  submission."review_note",
  submission."submitted_at",
  submission."reviewed_at",
  submission."submitted_at",
  submission."updated_at"
FROM "task_submissions" submission
JOIN "workflow_tasks" task ON task."id" = submission."task_id"
WHERE submission."document_version_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Attempt status and outcome can advance, but its exact submitted artifact,
-- task, milestone, submitter, attempt number, and timestamp cannot be rewritten.
CREATE FUNCTION "protect_task_submission_attempt_provenance"()
RETURNS TRIGGER AS $$
BEGIN
  IF
    NEW."task_submission_id" IS DISTINCT FROM OLD."task_submission_id" OR
    NEW."research_id" IS DISTINCT FROM OLD."research_id" OR
    NEW."task_id" IS DISTINCT FROM OLD."task_id" OR
    NEW."milestone_id" IS DISTINCT FROM OLD."milestone_id" OR
    NEW."document_id" IS DISTINCT FROM OLD."document_id" OR
    NEW."document_version_id" IS DISTINCT FROM OLD."document_version_id" OR
    NEW."attempt_number" IS DISTINCT FROM OLD."attempt_number" OR
    NEW."submitted_by" IS DISTINCT FROM OLD."submitted_by" OR
    NEW."note" IS DISTINCT FROM OLD."note" OR
    NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  THEN
    RAISE EXCEPTION 'Task submission attempt provenance cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "task_submission_attempts_protect_provenance_update"
BEFORE UPDATE ON "task_submission_attempts"
FOR EACH ROW EXECUTE FUNCTION "protect_task_submission_attempt_provenance"();
