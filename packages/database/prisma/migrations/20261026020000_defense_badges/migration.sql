CREATE TABLE "defense_badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "defense_session_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "issued_by" UUID NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipients" JSONB NOT NULL,
    CONSTRAINT "defense_badges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "defense_badges_kind_check" CHECK ("kind" IN ('TITLE_DEFENSE', 'FINAL_DEFENSE'))
);

CREATE UNIQUE INDEX "defense_badges_defense_session_id_key" ON "defense_badges"("defense_session_id");
CREATE INDEX "defense_badges_issued_by_idx" ON "defense_badges"("issued_by");
ALTER TABLE "defense_badges" ADD CONSTRAINT "defense_badges_defense_session_id_fkey" FOREIGN KEY ("defense_session_id") REFERENCES "defense_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "defense_badges" ADD CONSTRAINT "defense_badges_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
