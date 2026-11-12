CREATE TABLE "consultation_records" (
    "consultation_id" UUID NOT NULL,
    "actual_start" TIMESTAMP(3) NOT NULL,
    "actual_end" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "next_steps" TEXT NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviewer" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "correction" TEXT,
    "revision" INTEGER NOT NULL,
    CONSTRAINT "consultation_records_pkey" PRIMARY KEY ("consultation_id"),
    CONSTRAINT "consultation_records_consultation_id_fkey" FOREIGN KEY ("consultation_id")
        REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "consultation_records_valid_times" CHECK ("actual_start" < "actual_end"),
    CONSTRAINT "consultation_records_two_participants" CHECK ("submitted_by_id" <> "reviewer_id"),
    CONSTRAINT "consultation_records_valid_review" CHECK ("correction" IS NULL OR "reviewed_at" IS NOT NULL),
    CONSTRAINT "consultation_records_positive_revision" CHECK ("revision" > 0)
);
