ALTER TABLE "users"
  ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "password_reset_token_hash" VARCHAR(64),
  ADD COLUMN "password_reset_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_password_reset_token_hash_key" ON "users"("password_reset_token_hash");
