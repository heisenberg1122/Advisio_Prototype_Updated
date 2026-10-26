import { prisma } from "../lib/prisma.js";
import { emailNotification } from "./notification-email.service.js";

import { reminderDays, requirementDeadline } from "./deadline-email-policy.js";
export { reminderDays, requirementDeadline } from "./deadline-email-policy.js";

let running = false;
export async function queueDeadlineEmails(now = new Date()) {
  if (running || process.env.NOTIFICATION_EMAILS_ENABLED !== "true") return;
  running = true;
  try {
    let cursor: string | undefined;
    while (true) {
      const instances = await prisma.workflowInstance.findMany({
        where: {
          completedAt: null,
          workflow: { status: "PUBLISHED" },
          research: {
            is: { status: { notIn: ["ARCHIVED", "COMPLETED", "REJECTED"] } },
          },
        },
        orderBy: { id: "asc" },
        take: 50,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          currentStage: { include: { tasks: true } },
          transitions: { orderBy: { createdAt: "desc" } },
          research: {
            include: {
              members: {
                where: {
                  leftAt: null,
                  projectRole: { in: ["LEADER", "MEMBER"] },
                },
              },
              taskSubmissions: { select: { taskId: true, status: true } },
              documents: {
                select: { milestoneId: true, lifecycleStatus: true },
              },
            },
          },
        },
      });
      for (const instance of instances) {
        const stage = instance.currentStage;
        const research = instance.research;
        if (
          !stage ||
          !research ||
          stage.category === "Archived" ||
          stage.milestoneType === "ADVISER_SELECTION"
        )
          continue;
        const activation =
          instance.transitions.find(
            (transition) => transition.toStageId === stage.id,
          )?.createdAt || (stage.sequence === 1 ? instance.startedAt : null);
        const enrollments = await prisma.workflowEnrollment.findMany({
          where: {
            workflowId: instance.workflowId,
            status: "ACTIVE",
            userId: { in: research.members.map((member) => member.userId) },
          },
          select: { userId: true },
        });
        const enrolled = new Set(
          enrollments.map((enrollment) => enrollment.userId),
        );
        if (!enrolled.size) continue;
        const requirements = stage.tasks.length
          ? stage.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              dueDays: task.dueDays,
              task: true,
            }))
          : [{ id: stage.id, title: stage.name, dueDays: null, task: false }];
        for (const requirement of requirements) {
          if (
            requirement.task &&
            research.taskSubmissions.some(
              (submission) =>
                submission.taskId === requirement.id &&
                ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(
                  submission.status,
                ),
            )
          )
            continue;
          if (
            !requirement.task &&
            research.documents.some(
              (document) =>
                document.milestoneId === stage.id &&
                ["SUBMITTED", "IN_REVIEW", "APPROVED", "FINALIZED"].includes(
                  document.lifecycleStatus,
                ),
            )
          )
            continue;
          const dueAt = requirementDeadline(
            stage,
            activation,
            requirement.dueDays,
          );
          const days = dueAt && reminderDays(dueAt, now);
          if (!dueAt || !days) continue;
          const dueDate =
            new Intl.DateTimeFormat("en-PH", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "Asia/Manila",
            }).format(dueAt) + " (Asia/Manila)";
          await prisma.notification.createMany({
            skipDuplicates: true,
            data: research.members
              .filter((member) => enrolled.has(member.userId))
              .map((member) => ({
                recipientId: member.userId,
                audience: "researcher",
                type: "DEADLINE_APPROACHING" as const,
                title: `Due soon: ${requirement.title}`.slice(0, 200),
                message: `${research.title}: your pending requirement is due in ${days} day(s).`,
                entityType: requirement.task ? "WorkflowTask" : "WorkflowStage",
                entityId: requirement.id,
                actionUrl: `/student/tasks?projectId=${research.id}`,
                deduplicationKey: `due:${research.id}:${requirement.id}:${dueAt.getTime()}:${days}:${member.userId}`,
                ...emailNotification("requirement_due", {
                  title: requirement.title,
                  dueDate,
                  researchId: research.id,
                  taskId: requirement.task ? requirement.id : "",
                  milestoneId: stage.id,
                  dueAt: dueAt.toISOString(),
                }),
              })),
          });
        }
      }
      if (instances.length < 50) break;
      cursor = instances.at(-1)!.id;
    }
  } finally {
    running = false;
  }
}

export function startDeadlineEmailWorker() {
  const run = () =>
    void queueDeadlineEmails().catch(() =>
      console.warn("[DeadlineEmail] Reminder scan failed; will retry."),
    );
  const timer = setInterval(run, 60 * 60_000);
  timer.unref();
  run();
  return () => clearInterval(timer);
}
