ALTER TABLE "notifications"
  ADD COLUMN "email_template" VARCHAR(80),
  ADD COLUMN "email_data" JSONB,
  ADD COLUMN "email_next_attempt_at" TIMESTAMP(3),
  ADD COLUMN "email_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "email_sent_at" TIMESTAMP(3),
  ADD COLUMN "email_last_error" VARCHAR(300);
CREATE INDEX "notifications_email_next_attempt_at_idx" ON "notifications"("email_next_attempt_at");
ALTER TABLE "system_announcements"
  ADD COLUMN "audience_workflow_id" UUID,
  ADD COLUMN "audience_program_id" UUID;
