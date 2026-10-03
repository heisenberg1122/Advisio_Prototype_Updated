ALTER TABLE "users"
ADD COLUMN "max_advisee_groups" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "is_accepting_advisees" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "adviser_capacity_note" TEXT,
ADD COLUMN "adviser_capacity_set_by" UUID,
ADD COLUMN "adviser_capacity_set_at" TIMESTAMP(3);
