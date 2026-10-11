CREATE TABLE "workflow_stage_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stage_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "url" TEXT,
    "workflow_resource_id" UUID,
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(100),
    "file_size" INTEGER,
    "storage_path" TEXT,
    "google_drive_file_id" VARCHAR(255),
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_stage_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_stage_attachments_stage_id_workflow_resource_id_key"
ON "workflow_stage_attachments"("stage_id", "workflow_resource_id");
CREATE INDEX "workflow_stage_attachments_stage_id_created_at_idx"
ON "workflow_stage_attachments"("stage_id", "created_at");
CREATE INDEX "workflow_stage_attachments_workflow_resource_id_idx"
ON "workflow_stage_attachments"("workflow_resource_id");

ALTER TABLE "workflow_stage_attachments"
ADD CONSTRAINT "workflow_stage_attachments_stage_id_fkey"
FOREIGN KEY ("stage_id") REFERENCES "workflow_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_stage_attachments"
ADD CONSTRAINT "workflow_stage_attachments_workflow_resource_id_fkey"
FOREIGN KEY ("workflow_resource_id") REFERENCES "workflow_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
