CREATE TABLE "file_deletion_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "file_id" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "file_deletion_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "file_deletion_jobs_file_id_key" ON "file_deletion_jobs"("file_id");
CREATE INDEX "file_deletion_jobs_next_attempt_at_idx" ON "file_deletion_jobs"("next_attempt_at");
