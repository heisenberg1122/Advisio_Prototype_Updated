-- Run with psql as the migration owner, after separately creating a non-owner LOGIN
-- role and setting its password through your secret-management process:
-- psql "$DIRECT_URL" -v runtime_role=advisio_runtime -f audit-runtime-role.sql
-- No credentials are created or printed by this script.
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"runtime_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"runtime_role";
REVOKE ALL ON audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM :"runtime_role";
GRANT SELECT, INSERT ON audit_logs TO :"runtime_role";
-- Reapply grants after future migrations. Do not grant owner/migration-role membership.
