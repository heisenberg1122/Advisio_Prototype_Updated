-- Add an organizational topic layer between workflows and milestones.
CREATE TABLE "workflow_topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_topics_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "workflow_stages" ADD COLUMN "topic_id" UUID;

CREATE UNIQUE INDEX "workflow_topics_workflow_id_sequence_key"
ON "workflow_topics"("workflow_id", "sequence");

CREATE INDEX "workflow_topics_workflow_id_idx"
ON "workflow_topics"("workflow_id");

CREATE INDEX "workflow_stages_topic_id_idx"
ON "workflow_stages"("topic_id");

ALTER TABLE "workflow_topics"
ADD CONSTRAINT "workflow_topics_workflow_id_fkey"
FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_stages"
ADD CONSTRAINT "workflow_stages_topic_id_fkey"
FOREIGN KEY ("topic_id") REFERENCES "workflow_topics"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
