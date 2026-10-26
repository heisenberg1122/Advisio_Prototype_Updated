ALTER TABLE notifications ADD COLUMN audience VARCHAR(32) NOT NULL DEFAULT 'earlier';
ALTER TABLE notifications ADD CONSTRAINT notifications_audience_check
  CHECK (audience IN ('earlier','account','researcher','adviser','panelist','coordinator','dean','system-admin'));
CREATE INDEX notifications_recipient_id_audience_archived_at_created_at_idx
  ON notifications (recipient_id, audience, archived_at, created_at);

-- Backfill only unambiguous historical destinations. Unresolved deliveries stay
-- readable in Earlier notifications without contaminating a dashboard inbox.
UPDATE notifications SET audience = CASE
  WHEN action_url LIKE '/student/%' THEN 'researcher'
  WHEN action_url LIKE '/adviser/%' THEN 'adviser'
  WHEN action_url LIKE '/panelist/%' THEN 'panelist'
  WHEN action_url LIKE '/professor/%' THEN 'coordinator'
  WHEN action_url LIKE '/system-admin/%' THEN 'system-admin'
  WHEN entity_type IN ('SYSTEM_ANNOUNCEMENT','COLLEGE_ANNOUNCEMENT','ADVISER') THEN 'account'
  WHEN entity_type = 'ADVISER_CAPACITY' THEN 'adviser'
  ELSE 'earlier' END;
UPDATE notifications n SET audience = CASE WHEN n.recipient_id = a.adviser_id THEN 'adviser' ELSE 'researcher' END
FROM adviser_requests a WHERE n.entity_type = 'AdviserRequest' AND n.entity_id = a.id;

UPDATE notifications n SET audience = CASE a.review_type::text
  WHEN 'ADVISER' THEN 'adviser' WHEN 'PANEL' THEN 'panelist'
  WHEN 'COORDINATOR' THEN 'coordinator' WHEN 'DEAN' THEN 'dean' ELSE 'earlier' END
FROM reviewer_assignments a
WHERE n.entity_type = 'ReviewerAssignment' AND n.entity_id = a.id AND n.recipient_id = a.reviewer_id;

-- These prefixes are produced by createNotificationsOnce. Direct producers
-- (official-copy notifications, for example) retain their original key format.
UPDATE notifications SET deduplication_key = encode(digest(
  deduplication_key || ':' || recipient_id::text || ':' || audience, 'sha256'), 'hex')
WHERE audience <> 'earlier' AND deduplication_key ~ '^(review-assignment|manuscript|milestone|adviser-milestone|defense-packet|defense|task-attempt|task):';

-- Require every new producer to choose its recipient's responsibility.
ALTER TABLE notifications ALTER COLUMN audience DROP DEFAULT;
