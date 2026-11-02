CREATE TYPE "AccountInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'DELIVERY_FAILED');

CREATE TABLE "account_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" CITEXT NOT NULL,
  "university_id" VARCHAR(50) NOT NULL,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "role_names" "InstitutionalRole"[] NOT NULL,
  "college_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "verification_note" VARCHAR(1000) NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "status" "AccountInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "delivered_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_invitations_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "account_invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "account_invitations_allowed_roles" CHECK (
    cardinality("role_names") BETWEEN 1 AND 3 AND
    "role_names" <@ ARRAY['RESEARCH_COORDINATOR', 'PANELIST', 'DEAN']::"InstitutionalRole"[]
  )
);
CREATE UNIQUE INDEX "account_invitations_token_hash_key" ON "account_invitations"("token_hash");
CREATE INDEX "account_invitations_email_status_idx" ON "account_invitations"("email", "status");
CREATE INDEX "account_invitations_created_at_idx" ON "account_invitations"("created_at");
CREATE UNIQUE INDEX "account_invitations_pending_email_key" ON "account_invitations"("email") WHERE "status" = 'PENDING';
