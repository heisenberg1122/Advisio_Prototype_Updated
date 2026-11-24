ALTER TABLE "account_invitations"
  ALTER COLUMN "university_id" DROP NOT NULL,
  ALTER COLUMN "first_name" DROP NOT NULL,
  ALTER COLUMN "last_name" DROP NOT NULL,
  ALTER COLUMN "verification_note" DROP NOT NULL;
