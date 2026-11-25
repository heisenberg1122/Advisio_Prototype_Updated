CREATE TABLE "defense_certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "badge_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "coordinator" TEXT NOT NULL,
    "dean" TEXT NOT NULL,
    "college_name" TEXT NOT NULL,
    "college_code" TEXT NOT NULL,
    "research_title" TEXT NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "defense_certificates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "defense_certificates_badge_id_fkey"
        FOREIGN KEY ("badge_id") REFERENCES "defense_badges"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "defense_certificates_badge_id_recipient_id_key"
    ON "defense_certificates"("badge_id", "recipient_id");
