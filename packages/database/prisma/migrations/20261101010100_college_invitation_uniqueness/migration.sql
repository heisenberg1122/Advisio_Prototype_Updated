DROP INDEX "account_invitations_pending_email_key";
CREATE UNIQUE INDEX "account_invitations_pending_email_college_key"
ON "account_invitations" ("email", "college_id") WHERE "status" IN ('PENDING', 'AWAITING_APPROVAL');
