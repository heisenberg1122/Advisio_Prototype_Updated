CREATE TABLE "group_folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "research_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "group_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "research_id" UUID NOT NULL,
    "folder_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "storage_provider" VARCHAR(50) NOT NULL DEFAULT 'GOOGLE_DRIVE',
    "external_file_id" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "milestone_id" UUID,
    "promoted_document_id" UUID,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "group_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "group_folders_research_id_parent_id_name_idx" ON "group_folders"("research_id", "parent_id", "name");
CREATE INDEX "group_folders_research_id_parent_id_deleted_at_idx" ON "group_folders"("research_id", "parent_id", "deleted_at");
CREATE INDEX "group_files_research_id_folder_id_deleted_at_idx" ON "group_files"("research_id", "folder_id", "deleted_at");
CREATE INDEX "group_files_uploaded_by_idx" ON "group_files"("uploaded_by");

ALTER TABLE "group_folders" ADD CONSTRAINT "group_folders_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_folders" ADD CONSTRAINT "group_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "group_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "group_folders" ADD CONSTRAINT "group_folders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "group_files" ADD CONSTRAINT "group_files_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_files" ADD CONSTRAINT "group_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "group_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "group_files" ADD CONSTRAINT "group_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
