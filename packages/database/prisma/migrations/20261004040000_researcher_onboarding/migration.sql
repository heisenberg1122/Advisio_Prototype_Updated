CREATE TYPE "ResearcherDegreeLevel" AS ENUM ('UNDERGRADUATE', 'MASTERS', 'DOCTORATE', 'OTHER');
CREATE TYPE "ResearcherOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED');

ALTER TABLE "users"
ADD COLUMN "onboarding_token_hash" VARCHAR(64),
ADD COLUMN "onboarding_token_expires_at" TIMESTAMP(3);

CREATE TABLE "researcher_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "degree_level" "ResearcherDegreeLevel" NOT NULL,
  "other_degree_level" VARCHAR(100),
  "year_level" VARCHAR(50),
  "academic_stage" VARCHAR(50),
  "academic_term" VARCHAR(50) NOT NULL,
  "research_status" VARCHAR(50),
  "group_setup" VARCHAR(50),
  "invitation_code" VARCHAR(100),
  "tentative_title" VARCHAR(300),
  "research_type" VARCHAR(30),
  "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "ResearcherOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "submitted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "researcher_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "researcher_profiles_user_id_key" ON "researcher_profiles"("user_id");
CREATE INDEX "researcher_profiles_academic_year_id_idx" ON "researcher_profiles"("academic_year_id");
CREATE INDEX "researcher_profiles_status_idx" ON "researcher_profiles"("status");

ALTER TABLE "researcher_profiles"
ADD CONSTRAINT "researcher_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "researcher_profiles"
ADD CONSTRAINT "researcher_profiles_academic_year_id_fkey"
FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
