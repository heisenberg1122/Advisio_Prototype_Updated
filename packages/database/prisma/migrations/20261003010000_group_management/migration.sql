ALTER TABLE "research_projects"
ADD COLUMN "group_name" VARCHAR(120),
ADD COLUMN "invite_code" VARCHAR(32);

CREATE UNIQUE INDEX "research_projects_invite_code_key"
ON "research_projects"("invite_code");
