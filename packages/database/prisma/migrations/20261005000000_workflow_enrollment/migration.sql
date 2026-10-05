ALTER TABLE "workflows"
  ADD COLUMN "invite_code" VARCHAR(32),
  ADD COLUMN "invite_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "workflows_invite_code_key" ON "workflows"("invite_code");

ALTER TABLE "workflow_stages"
  ADD COLUMN "submission_mode" VARCHAR(20) NOT NULL DEFAULT 'EITHER';

CREATE TABLE "workflow_enrollments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workflow_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_enrollments_workflow_id_user_id_key"
  ON "workflow_enrollments"("workflow_id", "user_id");
CREATE INDEX "workflow_enrollments_user_id_status_idx"
  ON "workflow_enrollments"("user_id", "status");

ALTER TABLE "workflow_enrollments"
  ADD CONSTRAINT "workflow_enrollments_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_enrollments"
  ADD CONSTRAINT "workflow_enrollments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
