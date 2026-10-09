CREATE TABLE "workflow_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "google_drive_file_id" VARCHAR(255),
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_resources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_resources_workflow_id_updated_at_idx" ON "workflow_resources"("workflow_id", "updated_at");
CREATE INDEX "workflow_resources_uploaded_by_idx" ON "workflow_resources"("uploaded_by");

ALTER TABLE "workflow_resources" ADD CONSTRAINT "workflow_resources_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_resources" ADD CONSTRAINT "workflow_resources_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
