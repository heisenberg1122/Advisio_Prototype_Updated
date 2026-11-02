-- CreateTable
CREATE TABLE "class_record_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "weights" JSONB,
    "overall_weight" INTEGER,
    "late_credit" INTEGER NOT NULL DEFAULT 100,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_record_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_record_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "kind" VARCHAR(15) NOT NULL,
    "max_points" INTEGER NOT NULL,
    "task_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_record_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_record_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "score" DECIMAL(7,2),
    "state" VARCHAR(10) NOT NULL DEFAULT 'UNGRADED',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_record_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_record_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_record_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_record_attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_record_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_record_releases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "released_by_id" UUID NOT NULL,
    "released_by_name" VARCHAR(220) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_record_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_record_periods_workflow_id_code_key" ON "class_record_periods"("workflow_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "class_record_items_task_id_key" ON "class_record_items"("task_id");

-- CreateIndex
CREATE INDEX "class_record_items_period_id_idx" ON "class_record_items"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_record_scores_item_id_student_id_key" ON "class_record_scores"("item_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_record_sessions_period_id_date_key" ON "class_record_sessions"("period_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "class_record_attendance_session_id_student_id_key" ON "class_record_attendance"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "class_record_releases_period_id_student_id_released_at_idx" ON "class_record_releases"("period_id", "student_id", "released_at");

-- AddForeignKey
ALTER TABLE "class_record_periods" ADD CONSTRAINT "class_record_periods_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_record_items" ADD CONSTRAINT "class_record_items_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "class_record_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_record_items" ADD CONSTRAINT "class_record_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "workflow_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_record_scores" ADD CONSTRAINT "class_record_scores_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "class_record_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_record_scores" ADD CONSTRAINT "class_record_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_record_sessions" ADD CONSTRAINT "class_record_sessions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "class_record_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_record_attendance" ADD CONSTRAINT "class_record_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_record_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_record_attendance" ADD CONSTRAINT "class_record_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_record_releases" ADD CONSTRAINT "class_record_releases_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "class_record_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_record_releases" ADD CONSTRAINT "class_record_releases_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_record_periods" ADD CONSTRAINT "class_record_period_policy_check" CHECK (
  "code" IN ('PRELIM','MIDTERM','FINALS') AND "late_credit" BETWEEN 0 AND 100
  AND ("overall_weight" IS NULL OR "overall_weight" BETWEEN 0 AND 100) AND "revision" >= 0
);
ALTER TABLE "class_record_items" ADD CONSTRAINT "class_record_item_check" CHECK (
  "max_points" BETWEEN 1 AND 10000 AND length(trim("title")) >= 2
  AND (("kind" = 'MILESTONE' AND "task_id" IS NOT NULL) OR ("kind" = 'INDIVIDUAL' AND "task_id" IS NULL))
);
ALTER TABLE "class_record_scores" ADD CONSTRAINT "class_record_score_check" CHECK (
  ("state" = 'GRADED' AND "score" IS NOT NULL AND "score" BETWEEN 0 AND 10000)
  OR ("state" = 'MISSING' AND "score" IS NOT NULL AND "score" = 0)
  OR ("state" IN ('UNGRADED','EXCUSED') AND "score" IS NULL)
);
ALTER TABLE "class_record_attendance" ADD CONSTRAINT "class_record_attendance_check" CHECK ("status" IN ('PRESENT','ABSENT','LATE','EXCUSED'));
CREATE FUNCTION preserve_class_record_release() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Released class records cannot be edited or deleted; create a new release';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER preserve_class_record_release BEFORE UPDATE OR DELETE ON "class_record_releases" FOR EACH ROW EXECUTE FUNCTION preserve_class_record_release();
