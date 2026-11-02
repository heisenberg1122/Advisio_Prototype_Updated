CREATE TABLE "task_submission_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_submission_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "page_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_submission_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_submission_comments_body_check" CHECK (length(trim("body")) > 0),
    CONSTRAINT "task_submission_comments_page_check" CHECK ("page_number" IS NULL OR "page_number" > 0),
    CONSTRAINT "task_submission_comments_task_submission_id_fkey" FOREIGN KEY ("task_submission_id") REFERENCES "task_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_submission_comments_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_submission_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "task_submission_comments_thread_idx" ON "task_submission_comments"("task_submission_id", "document_version_id", "created_at", "id");
