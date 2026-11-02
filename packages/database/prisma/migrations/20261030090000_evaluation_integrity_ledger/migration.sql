ALTER TABLE "defense_sessions" ADD COLUMN "evaluation_ledger_started_at" TIMESTAMP(3);

-- Historical identifiers deliberately have no mutating/cascading foreign keys.
CREATE TABLE "evaluation_ledger_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "defense_session_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL CHECK ("sequence" > 0),
  "event_type" VARCHAR(40) NOT NULL CHECK ("event_type" IN ('FORM_PUBLISHED', 'EVALUATION_SUBMITTED', 'RESULT_RELEASED')),
  "payload_version" INTEGER NOT NULL DEFAULT 1 CHECK ("payload_version" = 1),
  "actor_id" UUID NOT NULL,
  "actor_roles" JSONB NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "operation_id" VARCHAR(200) NOT NULL,
  "payload" JSONB NOT NULL,
  "previous_hash" VARCHAR(64) NOT NULL CHECK ("previous_hash" ~ '^[0-9a-f]{64}$'),
  "event_hash" VARCHAR(64) NOT NULL CHECK ("event_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "evaluation_ledger_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "evaluation_ledger_events_session_sequence_key" UNIQUE ("defense_session_id", "sequence"),
  CONSTRAINT "evaluation_ledger_events_operation_id_key" UNIQUE ("operation_id")
);

CREATE FUNCTION reject_evaluation_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Evaluation ledger is append-only';
END;
$$;
CREATE TRIGGER evaluation_ledger_no_update_delete
BEFORE UPDATE OR DELETE ON "evaluation_ledger_events"
FOR EACH STATEMENT EXECUTE FUNCTION reject_evaluation_ledger_mutation();
CREATE TRIGGER evaluation_ledger_no_truncate
BEFORE TRUNCATE ON "evaluation_ledger_events"
FOR EACH STATEMENT EXECUTE FUNCTION reject_evaluation_ledger_mutation();

-- Owners can bypass triggers; deployment must use a separate non-owner runtime role.
REVOKE UPDATE, DELETE, TRUNCATE ON "evaluation_ledger_events" FROM PUBLIC;
