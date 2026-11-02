ALTER TABLE "workflow_tasks" ADD COLUMN "max_points" INTEGER;
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_max_points_check" CHECK ("max_points" IS NULL OR "max_points" BETWEEN 1 AND 10000);

CREATE TABLE "task_submission_grades" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "task_submission_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL,
  "max_points" INTEGER NOT NULL,
  "draft_score" DECIMAL(7,2),
  "released_score" DECIMAL(7,2),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updated_by_id" UUID NOT NULL,
  "released_by_id" UUID,
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_submission_grades_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_submission_grades_score_check" CHECK ("max_points" BETWEEN 1 AND 10000 AND ("draft_score" IS NULL OR "draft_score" BETWEEN 0 AND "max_points") AND ("released_score" IS NULL OR "released_score" BETWEEN 0 AND "max_points")),
  CONSTRAINT "task_submission_grades_release_check" CHECK (("released_score" IS NULL AND "released_at" IS NULL AND "released_by_id" IS NULL) OR ("released_score" IS NOT NULL AND "released_at" IS NOT NULL AND "released_by_id" IS NOT NULL)),
  CONSTRAINT "task_submission_grades_task_submission_id_fkey" FOREIGN KEY ("task_submission_id") REFERENCES "task_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_submission_grades_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "task_submission_grades_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "task_submission_grades_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "submission_grade_version_key" ON "task_submission_grades"("task_submission_id", "document_version_id");
CREATE INDEX "task_submission_grades_document_version_id_idx" ON "task_submission_grades"("document_version_id");

CREATE TABLE "task_submission_grade_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "grade_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL, "action" VARCHAR(30) NOT NULL,
  "score" DECIMAL(7,2) NOT NULL, "max_points" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_submission_grade_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_submission_grade_events_action_check" CHECK ("action" IN ('DRAFT_SAVED', 'GRADE_RELEASED')),
  CONSTRAINT "task_submission_grade_events_score_check" CHECK ("max_points" BETWEEN 1 AND 10000 AND "score" BETWEEN 0 AND "max_points"),
  CONSTRAINT "task_submission_grade_events_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "task_submission_grades"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_submission_grade_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "task_submission_grade_events_grade_id_created_at_idx" ON "task_submission_grade_events"("grade_id", "created_at");

CREATE FUNCTION preserve_submission_grade_history() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Grade history cannot be edited or deleted';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER preserve_submission_grade_history BEFORE UPDATE OR DELETE ON "task_submission_grade_events" FOR EACH ROW EXECUTE FUNCTION preserve_submission_grade_history();
