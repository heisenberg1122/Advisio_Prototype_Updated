CREATE TABLE "pdf_evaluation_artifacts" (
  "operation_key" VARCHAR(200) PRIMARY KEY,
  "file_id" VARCHAR(255) NOT NULL UNIQUE,
  "folder_id" VARCHAR(255) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "size" INTEGER NOT NULL CHECK ("size" > 0),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verified_at" TIMESTAMP(3)
);

ALTER TABLE "pdf_evaluations"
  ALTER COLUMN "source_data" DROP NOT NULL,
  ADD COLUMN "source_drive_file_id" VARCHAR(255),
  ADD COLUMN "final_drive_file_id" VARCHAR(255),
  ADD CONSTRAINT "pdf_evaluations_source_drive_file_id_fkey" FOREIGN KEY ("source_drive_file_id") REFERENCES "pdf_evaluation_artifacts"("file_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pdf_evaluations_final_drive_file_id_fkey" FOREIGN KEY ("final_drive_file_id") REFERENCES "pdf_evaluation_artifacts"("file_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  DROP CONSTRAINT "pdf_evaluations_final_check",
  ADD CONSTRAINT "pdf_evaluations_source_storage_check" CHECK (num_nonnulls("source_data", "source_drive_file_id") = 1),
  ADD CONSTRAINT "pdf_evaluations_final_check" CHECK (
    num_nonnulls("final_data", "final_drive_file_id") <= 1 AND
    ("status" <> 'LOCKED' OR (num_nonnulls("final_data", "final_drive_file_id") = 1 AND "integrity_hash" IS NOT NULL AND "locked_at" IS NOT NULL))
  );

CREATE INDEX "pdf_evaluations_source_drive_file_id_idx" ON "pdf_evaluations"("source_drive_file_id");
CREATE UNIQUE INDEX "pdf_evaluations_final_drive_file_id_key" ON "pdf_evaluations"("final_drive_file_id");
