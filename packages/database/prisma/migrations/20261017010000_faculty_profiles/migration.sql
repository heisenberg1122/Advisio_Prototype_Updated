-- CreateTable
CREATE TABLE "faculty_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "academic_title" VARCHAR(100),
    "faculty_designation" VARCHAR(150),
    "department" VARCHAR(150),
    "photo_url" TEXT,
    "biography" TEXT,
    "teaching_background" TEXT,
    "mentoring_philosophy" TEXT,
    "preferred_project_types" TEXT,
    "expertise_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "research_interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialized_topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supervision_methodologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accepted_research_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "advising_preferences" TEXT,
    "educations" JSONB NOT NULL DEFAULT '[]',
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "experiences" JSONB NOT NULL DEFAULT '[]',
    "publications" JSONB NOT NULL DEFAULT '[]',
    "awards" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "faculty_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "faculty_profiles_user_id_key" ON "faculty_profiles"("user_id");
