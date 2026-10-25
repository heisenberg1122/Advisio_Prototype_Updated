CREATE TABLE "workflow_access_entries" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(), "workflow_id" UUID NOT NULL, "user_id" UUID NOT NULL,
"kind" VARCHAR(20) NOT NULL CHECK ("kind" IN ('REQUEST','INVITATION')),
"status" VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','ACCEPTED','DECLINED','CANCELLED','REVOKED')),
"actor_id" UUID NOT NULL, "decided_by" UUID, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "decided_at" TIMESTAMP(3), "mail_thread_id" UUID,
CONSTRAINT "workflow_access_entries_pkey" PRIMARY KEY ("id"),
CONSTRAINT "workflow_access_entries_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT "workflow_access_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT "workflow_access_entries_mail_thread_id_fkey" FOREIGN KEY ("mail_thread_id") REFERENCES "mail_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workflow_access_entries_workflow_id_user_id_kind_key" ON "workflow_access_entries"("workflow_id","user_id","kind");
CREATE UNIQUE INDEX "workflow_access_entries_mail_thread_id_key" ON "workflow_access_entries"("mail_thread_id");
CREATE INDEX "workflow_access_entries_workflow_id_kind_status_idx" ON "workflow_access_entries"("workflow_id","kind","status");
CREATE INDEX "workflow_access_entries_user_id_status_idx" ON "workflow_access_entries"("user_id","status");
