ALTER TYPE "AccountInvitationStatus" ADD VALUE 'AWAITING_APPROVAL';
ALTER TYPE "AccountInvitationStatus" ADD VALUE 'REJECTED';
ALTER TABLE "account_invitations"
  ADD COLUMN "approved_by_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "review_note" VARCHAR(1000),
  ADD COLUMN "last_sent_at" TIMESTAMP(3);
UPDATE "account_invitations" SET "last_sent_at" = COALESCE("delivered_at", "created_at");
ALTER TABLE "account_invitations" DROP CONSTRAINT "account_invitations_allowed_roles";
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_allowed_roles" CHECK (
  cardinality("role_names") BETWEEN 1 AND 4 AND
  "role_names" <@ ARRAY['ADVISER', 'RESEARCH_COORDINATOR', 'PANELIST', 'DEAN']::"InstitutionalRole"[]
);
CREATE TABLE "college_memberships" (
  "user_id" UUID NOT NULL,
  "college_id" UUID NOT NULL,
  "role_names" "InstitutionalRole"[] NOT NULL,
  "granted_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "college_memberships_pkey" PRIMARY KEY ("user_id", "college_id"),
  CONSTRAINT "college_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "college_memberships_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "college_memberships_faculty_roles" CHECK (
    cardinality("role_names") BETWEEN 1 AND 4 AND
    "role_names" <@ ARRAY['ADVISER', 'RESEARCH_COORDINATOR', 'PANELIST', 'DEAN']::"InstitutionalRole"[]
  )
);
CREATE INDEX "college_memberships_college_id_idx" ON "college_memberships"("college_id");
INSERT INTO "college_memberships" ("user_id", "college_id", "role_names")
SELECT u."id", u."college_id", array_agg(DISTINCT r."name")
FROM "users" u JOIN "user_roles" ur ON ur."user_id" = u."id" JOIN "roles" r ON r."id" = ur."role_id"
WHERE u."college_id" IS NOT NULL AND r."name" IN ('ADVISER', 'PANELIST', 'RESEARCH_COORDINATOR', 'DEAN')
GROUP BY u."id", u."college_id";
