ALTER TABLE "storage_integrations"
  ADD COLUMN "quota_limit_bytes" BIGINT,
  ADD COLUMN "quota_used_bytes" BIGINT,
  ADD COLUMN "quota_drive_bytes" BIGINT,
  ADD COLUMN "quota_checked_at" TIMESTAMP(3),
  ADD COLUMN "quota_attempted_at" TIMESTAMP(3),
  ADD COLUMN "quota_error" TEXT;
