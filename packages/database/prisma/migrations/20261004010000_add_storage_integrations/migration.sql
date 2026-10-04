CREATE TYPE "IntegrationStatus" AS ENUM (
  'DISCONNECTED',
  'HEALTHY',
  'DEGRADED',
  'ACTION_REQUIRED',
  'FOLDER_INACCESSIBLE',
  'MISCONFIGURED'
);

CREATE TABLE "storage_integrations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" VARCHAR(40) NOT NULL,
  "authentication_type" VARCHAR(30) NOT NULL DEFAULT 'OAUTH',
  "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "account_email" VARCHAR(255),
  "account_display_name" VARCHAR(255),
  "account_photo_url" TEXT,
  "encrypted_refresh_token" TEXT,
  "root_folder_id" VARCHAR(255),
  "root_folder_name" VARCHAR(255),
  "shared_drive_id" VARCHAR(255),
  "connected_by" UUID,
  "connected_at" TIMESTAMP(3),
  "last_checked_at" TIMESTAMP(3),
  "last_healthy_at" TIMESTAMP(3),
  "last_error_code" VARCHAR(80),
  "last_error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "storage_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storage_integrations_provider_key" ON "storage_integrations"("provider");
CREATE INDEX "storage_integrations_status_idx" ON "storage_integrations"("status");
