-- CreateEnum
CREATE TYPE "ResearchCohortStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResearchCohortMemberStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- AlterTable
ALTER TABLE "research_projects" ADD COLUMN     "cohort_id" UUID;

-- AlterTable
ALTER TABLE "research_workspaces" ADD COLUMN     "cohort_id" UUID;

-- CreateTable
CREATE TABLE "research_cohorts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "college_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "research_type_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "workflow_id" UUID,
    "status" "ResearchCohortStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_cohort_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "ResearchCohortMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "research_cohort_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_cohorts_college_id_program_id_idx" ON "research_cohorts"("college_id", "program_id");

-- CreateIndex
CREATE INDEX "research_cohorts_academic_year_id_idx" ON "research_cohorts"("academic_year_id");

-- CreateIndex
CREATE INDEX "research_cohorts_research_type_id_idx" ON "research_cohorts"("research_type_id");

-- CreateIndex
CREATE INDEX "research_cohorts_workflow_id_idx" ON "research_cohorts"("workflow_id");

-- CreateIndex
CREATE INDEX "research_cohorts_created_by_idx" ON "research_cohorts"("created_by");

-- CreateIndex
CREATE INDEX "research_cohorts_status_idx" ON "research_cohorts"("status");

-- CreateIndex
CREATE INDEX "research_cohort_members_user_id_status_idx" ON "research_cohort_members"("user_id", "status");

-- CreateIndex
CREATE INDEX "research_cohort_members_cohort_id_status_idx" ON "research_cohort_members"("cohort_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "research_cohort_members_cohort_id_user_id_key" ON "research_cohort_members"("cohort_id", "user_id");

-- CreateIndex
CREATE INDEX "research_projects_cohort_id_idx" ON "research_projects"("cohort_id");

-- CreateIndex
CREATE INDEX "research_workspaces_cohort_id_idx" ON "research_workspaces"("cohort_id");

-- AddForeignKey
ALTER TABLE "research_cohorts" ADD CONSTRAINT "research_cohorts_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_cohorts" ADD CONSTRAINT "research_cohorts_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_cohorts" ADD CONSTRAINT "research_cohorts_research_type_id_fkey" FOREIGN KEY ("research_type_id") REFERENCES "research_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_cohorts" ADD CONSTRAINT "research_cohorts_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_cohorts" ADD CONSTRAINT "research_cohorts_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_cohorts" ADD CONSTRAINT "research_cohorts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_cohort_members" ADD CONSTRAINT "research_cohort_members_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "research_cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_cohort_members" ADD CONSTRAINT "research_cohort_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "research_cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_workspaces" ADD CONSTRAINT "research_workspaces_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "research_cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

