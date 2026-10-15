-- Existing rows were backfilled by the defaults in the preceding migration.
-- New writes are maintained by Prisma's @updatedAt behavior.
ALTER TABLE "consultations"
ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "consultation_notes"
ALTER COLUMN "updated_at" DROP DEFAULT;
