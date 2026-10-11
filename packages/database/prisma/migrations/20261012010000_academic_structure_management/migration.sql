-- Add optional major configuration to programs.
ALTER TABLE "programs"
ADD COLUMN "has_majors" BOOLEAN NOT NULL DEFAULT false;

-- Store majors/specializations independently so existing programs remain valid.
CREATE TABLE "program_majors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "code" VARCHAR(20),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_majors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_majors_program_id_name_key"
ON "program_majors"("program_id", "name");

CREATE UNIQUE INDEX "program_majors_program_id_code_key"
ON "program_majors"("program_id", "code");

CREATE INDEX "program_majors_program_id_is_active_idx"
ON "program_majors"("program_id", "is_active");

ALTER TABLE "program_majors"
ADD CONSTRAINT "program_majors_program_id_fkey"
FOREIGN KEY ("program_id") REFERENCES "programs"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
