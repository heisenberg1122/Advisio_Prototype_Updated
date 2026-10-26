import {
  notificationTemplateOverrides,
  renderNotificationEmail,
  sendEmail,
  emailDeliveryDiagnostic,
} from "@research-management/email";
import { readFile } from "node:fs/promises";
import { getWorkspaceById } from "@research-management/auth";
import { requirementDeadline } from "./deadline-email-policy.js";
import { prisma } from "../lib/prisma.js";

/** Store alongside the in-app notification, in the event's transaction. */
export function emailNotification(
  template: string,
  data: Record<string, string> = {},
) {
  return {
    emailTemplate: template,
    emailData: data,
    emailNextAttemptAt: new Date(),
  };
}

export function notificationEmailAction(
  actionUrl: string | null,
  audience: string,
) {
  const workspace = getWorkspaceById(audience);
  if (actionUrl?.startsWith("/research/manuscript")) {
    return actionUrl.replace(
      "/research/manuscript",
      audience === "researcher"
        ? "/student/documents"
        : `${workspace?.routePrefix || "/student"}/reviews`,
    );
  }
  return actionUrl || workspace?.homeUrl || "/";
}

let running = false;
export async function processNotificationEmails() {
  if (running || process.env.NOTIFICATION_EMAILS_ENABLED !== "true") return;
  const provider =
    process.env.EMAIL_PROVIDER ||
    (process.env.RESEND_API_KEY ? "resend" : "mock");
  // Never mark queued notifications delivered by the development mock.
  if (!["gmail", "resend"].includes(provider)) return;
  running = true;
  try {
    const templates = process.env.EMAIL_TEMPLATE_OVERRIDES_PATH
      ? notificationTemplateOverrides(
          JSON.parse(
            await readFile(process.env.EMAIL_TEMPLATE_OVERRIDES_PATH, "utf8"),
          ),
        )
      : undefined;
    await prisma.notification.updateMany({
      where: {
        emailAttempts: { gte: 5 },
        emailNextAttemptAt: { lte: new Date() },
        emailSentAt: null,
      },
      data: {
        emailNextAttemptAt: null,
        emailLastError: "Maximum email delivery attempts reached.",
      },
    });
    const jobs = await prisma.notification.findMany({
      where: {
        emailNextAttemptAt: { lte: new Date() },
        emailSentAt: null,
        emailAttempts: { lt: 5 },
      },
      orderBy: { emailNextAttemptAt: "asc" },
      take: 10,
      include: {
        recipient: { select: { email: true, firstName: true, status: true } },
      },
    });
    for (const job of jobs) {
      const lease = new Date(Date.now() + 120_000);
      const claimed = await prisma.notification.updateMany({
        where: {
          id: job.id,
          emailNextAttemptAt: { lte: new Date() },
          emailSentAt: null,
          emailAttempts: { lt: 5 },
        },
        data: { emailNextAttemptAt: lease, emailAttempts: { increment: 1 } },
      });
      if (!claimed.count) continue;
      const owned = { id: job.id, emailNextAttemptAt: lease };
      if (job.recipient.status !== "ACTIVE") {
        await prisma.notification.updateMany({
          where: owned,
          data: {
            emailNextAttemptAt: null,
            emailLastError: "Recipient account is not active.",
          },
        });
        continue;
      }
      let diagnostic = "Email rendering or configuration failed. Check WEB_URL, logo URL, and required template variables.";
      try {
        const webUrl = process.env.WEB_URL || "";
        if (
          process.env.NODE_ENV === "production" &&
          new URL(webUrl).protocol !== "https:"
        )
          throw new Error("HTTPS WEB_URL required.");
        const variables = Object.fromEntries(
          Object.entries(
            (job.emailData || {}) as Record<string, unknown>,
          ).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        );
        if (
          job.emailTemplate === "requirement_created" &&
          variables.workflowId &&
          !(await prisma.workflowEnrollment.findFirst({
            where: {
              workflowId: variables.workflowId,
              userId: job.recipientId,
              status: "ACTIVE",
            },
            select: { id: true },
          }))
        ) {
          await prisma.notification.updateMany({
            where: owned,
            data: {
              emailNextAttemptAt: null,
              emailLastError: "Workflow access is no longer active.",
            },
          });
          continue;
        }
        if (job.emailTemplate === "announcement" && variables.collegeId) {
          const recipient = await prisma.user.findFirst({
            where: {
              id: job.recipientId,
              status: "ACTIVE",
              collegeId: variables.collegeId,
              ...(variables.programId
                ? { programId: variables.programId }
                : {}),
              ...(variables.workflowId
                ? {
                    OR: [
                      {
                        workflowEnrollments: {
                          some: {
                            workflowId: variables.workflowId,
                            status: "ACTIVE",
                          },
                        },
                      },
                      {
                        memberships: {
                          some: {
                            leftAt: null,
                            projectRole: {
                              in: ["ADVISER", "PANELIST", "COORDINATOR"],
                            },
                            research: {
                              workflowInstance: {
                                workflowId: variables.workflowId,
                              },
                            },
                          },
                        },
                      },
                    ],
                  }
                : {}),
            },
            select: { id: true },
          });
          if (!recipient) {
            await prisma.notification.updateMany({
              where: owned,
              data: {
                emailNextAttemptAt: null,
                emailLastError:
                  "Recipient is no longer in the announcement audience.",
              },
            });
            continue;
          }
        }
        if (job.emailTemplate === "requirement_due" && variables.researchId) {
          const project = await prisma.researchProject.findFirst({
            where: {
              id: variables.researchId,
              status: { notIn: ["ARCHIVED", "COMPLETED", "REJECTED"] },
              members: { some: { userId: job.recipientId, leftAt: null } },
            },
            select: {
              id: true,
              workflowInstance: {
                include: {
                  currentStage: true,
                  transitions: { orderBy: { createdAt: "desc" } },
                },
              },
            },
          });
          const submitted = variables.taskId
            ? await prisma.taskSubmission.findFirst({
                where: {
                  researchId: variables.researchId,
                  taskId: variables.taskId,
                  status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
                },
                select: { id: true },
              })
            : await prisma.document.findFirst({
                where: {
                  researchId: variables.researchId,
                  milestoneId: variables.milestoneId,
                  lifecycleStatus: {
                    in: ["SUBMITTED", "IN_REVIEW", "APPROVED", "FINALIZED"],
                  },
                },
                select: { id: true },
              });
          if (
            !project ||
            submitted ||
            new Date(variables.dueAt) <= new Date()
          ) {
            await prisma.notification.updateMany({
              where: owned,
              data: {
                emailNextAttemptAt: null,
                emailLastError: "Reminder no longer applicable.",
              },
            });
            continue;
          }
          const instance = project.workflowInstance;
          const stage = instance?.currentStage;
          const enrollment =
            instance &&
            (await prisma.workflowEnrollment.findFirst({
              where: {
                workflowId: instance.workflowId,
                userId: job.recipientId,
                status: "ACTIVE",
              },
              select: { id: true },
            }));
          const task = variables.taskId
            ? await prisma.workflowTask.findUnique({
                where: { id: variables.taskId },
                select: { dueDays: true, stageId: true },
              })
            : null;
          const activation =
            instance?.transitions.find(
              (transition) => transition.toStageId === stage?.id,
            )?.createdAt ||
            (stage?.sequence === 1 ? instance?.startedAt : null);
          const currentDue =
            stage &&
            requirementDeadline(stage, activation || null, task?.dueDays);
          if (
            !stage ||
            !enrollment ||
            stage.id !== variables.milestoneId ||
            (variables.taskId && task?.stageId !== stage.id) ||
            currentDue?.toISOString() !== variables.dueAt
          ) {
            await prisma.notification.updateMany({
              where: owned,
              data: {
                emailNextAttemptAt: null,
                emailLastError:
                  "Requirement schedule changed; old reminder suppressed.",
              },
            });
            continue;
          }
        }
        const rendered = renderNotificationEmail(
          job.emailTemplate!,
          {
            title: job.title,
            message: job.message,
            ...variables,
            firstName: job.recipient.firstName,
          },
          {
            webUrl,
            actionUrl: notificationEmailAction(job.actionUrl, job.audience),
            logoUrl: process.env.EMAIL_LOGO_URL,
            templates,
          },
        );
        const result = await sendEmail({
          to: job.recipient.email,
          ...rendered,
        });
        if (!result.success) {
          diagnostic = emailDeliveryDiagnostic(result);
          throw new Error("Provider delivery failed.");
        }
        diagnostic = "Provider accepted the email, but its delivery acknowledgement could not be saved.";
        await prisma.notification.updateMany({
          where: owned,
          data: {
            emailSentAt: new Date(),
            emailNextAttemptAt: null,
            emailLastError: null,
          },
        });
      } catch {
        await prisma.notification.updateMany({
          where: owned,
          data: {
            emailNextAttemptAt:
              job.emailAttempts + 1 >= 5
                ? null
                : new Date(Date.now() + 60_000 * 2 ** job.emailAttempts),
            emailLastError: diagnostic,
          },
        });
        console.warn("[NotificationEmail] Delivery failed", job.id, diagnostic);
      }
    }
  } finally {
    running = false;
  }
}

export function startNotificationEmailWorker() {
  const run = () =>
    void processNotificationEmails().catch(() =>
      console.warn("[NotificationEmail] Queue unavailable; will retry."),
    );
  const timer = setInterval(run, 30_000);
  timer.unref();
  run();
  return () => clearInterval(timer);
}
