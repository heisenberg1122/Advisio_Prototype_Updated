CREATE TYPE "TaskSubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED');

CREATE TABLE "workflow_tasks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stage_id" UUID NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "instructions" TEXT,
  "sequence" INTEGER NOT NULL,
  "due_days" INTEGER,
  "allowed_file_types" VARCHAR(100) NOT NULL DEFAULT 'PDF,DOCX',
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "research_id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "submitted_by" UUID NOT NULL,
  "status" "TaskSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "note" TEXT,
  "review_note" TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_tasks_stage_id_sequence_key" ON "workflow_tasks"("stage_id", "sequence");
CREATE INDEX "workflow_tasks_stage_id_idx" ON "workflow_tasks"("stage_id");
CREATE UNIQUE INDEX "task_submissions_research_id_task_id_key" ON "task_submissions"("research_id", "task_id");
CREATE INDEX "task_submissions_task_id_status_idx" ON "task_submissions"("task_id", "status");
CREATE INDEX "task_submissions_submitted_by_idx" ON "task_submissions"("submitted_by");

ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "workflow_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "workflow_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
