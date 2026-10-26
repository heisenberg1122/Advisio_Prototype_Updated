BEGIN;

-- Do not silently move a mandatory academic approval to a different office.
-- Existing workflows must explicitly reassign these responsibilities first.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM workflow_stages s JOIN roles r ON r.id = s.responsible_role_id
             WHERE r.name::text IN ('REB', 'VPAA')) THEN
    RAISE EXCEPTION 'Reassign workflow stages owned by REB/VPAA to a supported role before retiring those offices. Approval requirements have not been changed.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM reviewer_assignments a
    WHERE a.status::text = 'ACTIVE'
      AND EXISTS (SELECT 1 FROM user_roles u JOIN roles r ON r.id = u.role_id
                  WHERE u.user_id = a.reviewer_id AND r.name::text IN ('REB', 'VPAA'))
      AND NOT EXISTS (
        SELECT 1 FROM user_roles u JOIN roles r ON r.id = u.role_id
        WHERE u.user_id = a.reviewer_id AND r.name::text = CASE a.review_type::text
          WHEN 'ADVISER' THEN 'ADVISER' WHEN 'PANEL' THEN 'PANELIST'
          WHEN 'COORDINATOR' THEN 'RESEARCH_COORDINATOR' WHEN 'DEAN' THEN 'RPO'
          ELSE '' END)
  ) THEN
    RAISE EXCEPTION 'Resolve active reviewer assignments that depend on REB/VPAA before retiring those offices. Required reviews have not been waived.';
  END IF;
END $$;

-- Preserve removed assignments and office configuration in the existing audit log.
INSERT INTO audit_logs (action, entity_type, entity_id, old_values, new_values)
SELECT 'ROLE_CHANGE', 'RetiredInstitutionalRole', r.id,
       jsonb_build_object('role', to_jsonb(r),
         'assignments', (SELECT coalesce(jsonb_agg(to_jsonb(u)), '[]') FROM user_roles u WHERE u.role_id = r.id),
         'permissions', (SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]') FROM role_permissions p WHERE p.role_id = r.id),
         'widgets', (SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]') FROM role_dashboard_widgets w WHERE w.role_id = r.id)),
       '{"retired":true,"migration":"20261026060000"}'::jsonb
FROM roles r WHERE r.name::text IN ('REB', 'VPAA');

DELETE FROM roles WHERE name::text IN ('REB', 'VPAA');
-- Rename in place: existing Dean assignments, permissions and workflow references retain their IDs.
ALTER TYPE "InstitutionalRole" RENAME VALUE 'RPO' TO 'DEAN';
UPDATE roles SET description = 'Dean', updated_at = now() WHERE name::text = 'DEAN';
ALTER TYPE "InstitutionalRole" RENAME TO "InstitutionalRole_old";
CREATE TYPE "InstitutionalRole" AS ENUM ('RESEARCHER','ADVISER','PANELIST','RESEARCH_COORDINATOR','DEAN','SYSTEM_ADMIN');
ALTER TABLE roles ALTER COLUMN name TYPE "InstitutionalRole" USING name::text::"InstitutionalRole";
DROP TYPE "InstitutionalRole_old";
UPDATE permissions SET key = replace(key, 'rpo.', 'dean.'), module = 'DEAN'
WHERE key LIKE 'rpo.%';
-- Removed-office permissions must not survive as custom grants on other roles.
DELETE FROM permissions WHERE key LIKE 'vpaa.%' OR key LIKE 'reb.%';
COMMIT;
