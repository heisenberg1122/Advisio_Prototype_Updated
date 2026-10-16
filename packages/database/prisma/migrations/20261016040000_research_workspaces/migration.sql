CREATE TYPE "WorkspaceMemberRole" AS ENUM ('LEADER', 'MEMBER');

CREATE TABLE "research_workspaces" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "participation_mode" "ResearchParticipationMode" NOT NULL,
  "access_mode" "ResearchAccessMode" NOT NULL DEFAULT 'INVITE_ONLY',
  "invite_code" VARCHAR(32) NOT NULL,
  "invite_code_enabled" BOOLEAN NOT NULL DEFAULT true,
  "college_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "research_workspaces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "research_workspaces_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "research_workspaces_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "research_workspaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "research_workspaces_invite_code_key" ON "research_workspaces"("invite_code");
CREATE INDEX "research_workspaces_college_id_program_id_idx" ON "research_workspaces"("college_id", "program_id");
CREATE INDEX "research_workspaces_created_by_idx" ON "research_workspaces"("created_by");

CREATE TABLE "workspace_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'MEMBER',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMP(3),
  CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "research_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");
CREATE INDEX "workspace_members_user_id_left_at_idx" ON "workspace_members"("user_id", "left_at");

ALTER TABLE "research_projects" ADD COLUMN "workspace_id" UUID;
CREATE INDEX "research_projects_workspace_id_idx" ON "research_projects"("workspace_id");
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "research_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve existing project groups by migrating each project into its own initial workspace.
DO $$
DECLARE
  project_row RECORD;
  new_workspace_id UUID;
BEGIN
  FOR project_row IN SELECT * FROM "research_projects" LOOP
    new_workspace_id := gen_random_uuid();
    INSERT INTO "research_workspaces" (
      "id", "name", "participation_mode", "access_mode", "invite_code", "invite_code_enabled",
      "college_id", "program_id", "created_by", "created_at", "updated_at"
    ) VALUES (
      new_workspace_id,
      LEFT(COALESCE(NULLIF(project_row."group_name", ''), project_row."title"), 120),
      project_row."participation_mode", project_row."access_mode",
      UPPER(ENCODE(gen_random_bytes(6), 'hex')),
      project_row."participation_mode" = 'GROUP' AND project_row."invite_code_enabled",
      project_row."college_id", project_row."program_id", project_row."created_by",
      project_row."created_at", project_row."updated_at"
    );
    UPDATE "research_projects" SET "workspace_id" = new_workspace_id WHERE "id" = project_row."id";

    INSERT INTO "workspace_members" ("workspace_id", "user_id", "role", "joined_at", "left_at")
    SELECT new_workspace_id, "user_id",
      CASE WHEN BOOL_OR("projectRole" = 'LEADER' AND "left_at" IS NULL) THEN 'LEADER'::"WorkspaceMemberRole" ELSE 'MEMBER'::"WorkspaceMemberRole" END,
      MIN("joined_at"), CASE WHEN BOOL_OR("left_at" IS NULL) THEN NULL ELSE MAX("left_at") END
    FROM "research_members"
    WHERE "research_id" = project_row."id" AND "projectRole" IN ('LEADER', 'MEMBER')
    GROUP BY "user_id"
    ON CONFLICT ("workspace_id", "user_id") DO NOTHING;

    INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
    VALUES (new_workspace_id, project_row."created_by", 'LEADER')
    ON CONFLICT ("workspace_id", "user_id") DO UPDATE SET "role" = 'LEADER', "left_at" = NULL;
  END LOOP;
END $$;
