ALTER TABLE "file_deletion_jobs"
ADD COLUMN "provider" VARCHAR(40) NOT NULL DEFAULT 'GOOGLE_DRIVE',
ADD COLUMN "storage_path" TEXT;
