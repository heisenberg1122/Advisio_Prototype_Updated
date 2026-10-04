CREATE TABLE "storage_folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(40) NOT NULL,
    "path_key" VARCHAR(1000) NOT NULL,
    "external_folder_id" VARCHAR(255) NOT NULL,
    "parent_folder_id" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "storage_folders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storage_folders_provider_path_key_key" ON "storage_folders"("provider", "path_key");
CREATE UNIQUE INDEX "storage_folders_provider_external_folder_id_key" ON "storage_folders"("provider", "external_folder_id");
CREATE INDEX "storage_folders_entity_type_entity_id_idx" ON "storage_folders"("entity_type", "entity_id");
