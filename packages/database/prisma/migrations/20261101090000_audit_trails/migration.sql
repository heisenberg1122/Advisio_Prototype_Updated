ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_user_id_fkey;
ALTER TABLE audit_logs
  ADD COLUMN actor_reference uuid,
  ADD COLUMN actor_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN contract_version integer NOT NULL DEFAULT 0,
  ADD COLUMN event_type varchar(100),
  ADD COLUMN category varchar(20) NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN outcome varchar(20) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN request_id uuid,
  ADD COLUMN research_id uuid,
  ADD COLUMN operation_key varchar(160),
  ADD COLUMN summary_count integer,
  ADD COLUMN first_occurred_at timestamp(3),
  ADD COLUMN last_occurred_at timestamp(3);
UPDATE audit_logs SET actor_reference = user_id;
CREATE UNIQUE INDEX audit_logs_operation_key_key ON audit_logs(operation_key);
CREATE INDEX audit_logs_created_at_id_idx ON audit_logs(created_at, id);
CREATE INDEX audit_logs_category_created_at_id_idx ON audit_logs(category, created_at, id);
CREATE INDEX audit_logs_research_id_created_at_id_idx ON audit_logs(research_id, created_at, id);

-- The runtime role must not own this table or inherit its owner's privileges.
-- Owners retain maintenance access for migrations, isolated fixtures and approved retention.
CREATE FUNCTION protect_audit_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_name text;
BEGIN
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid = TG_RELID;
  IF NOT pg_has_role(current_user, owner_name, 'USAGE') THEN
    RAISE EXCEPTION 'Audit history is append-only';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_history_write_guard BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION protect_audit_history();
CREATE TRIGGER audit_history_truncate_guard BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION protect_audit_history();
