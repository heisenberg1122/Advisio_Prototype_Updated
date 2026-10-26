import { createHash } from "node:crypto";
import {
  getEligibleWorkspaces,
  getWorkspaceById,
} from "@research-management/auth";
import type { Prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

export function notificationInbox(
  user: AuthenticatedUser,
  value: unknown,
): string {
  if (typeof value !== "string")
    throw Object.assign(new Error("Choose a notification inbox."), {
      statusCode: 400,
    });
  if (value === "account" || value === "earlier") return value;
  if (!getWorkspaceById(value))
    throw Object.assign(new Error("Unknown notification inbox."), {
      statusCode: 400,
    });
  if (
    !getEligibleWorkspaces(user.roles).some(
      (workspace) => workspace.id === value,
    )
  ) {
    throw Object.assign(
      new Error("This dashboard is not assigned to your account."),
      { statusCode: 403 },
    );
  }
  return value;
}

export function notificationWhere(
  user: AuthenticatedUser,
  inbox: unknown,
): Prisma.NotificationWhereInput {
  return {
    recipientId: user.id,
    archivedAt: null,
    audience: notificationInbox(user, inbox),
  };
}

export const reviewAudience = (reviewType: string): string | null =>
  ({
    ADVISER: "adviser",
    PANEL: "panelist",
    COORDINATOR: "coordinator",
    DEAN: "dean",
  })[reviewType] || null;

export function defenseAudience(role: string): string {
  if (role === "PANELIST" || role === "PANEL_CHAIR") return "panelist";
  if (role === "ADVISER") return "adviser";
  // Observers have no academic decision responsibility; their invitation is personal.
  return "account";
}

export async function defenseSchedulerAudience(
  tx: Prisma.TransactionClient,
  userId: string,
  researchId: string,
): Promise<string> {
  const scheduler = await tx.user.findUnique({
    where: { id: userId },
    select: { roles: { select: { role: { select: { name: true } } } } },
  });
  const roles = scheduler?.roles.map(({ role }) => role.name) || [];
  if (roles.includes("RESEARCH_COORDINATOR")) {
    const project = await tx.researchProject.findUnique({
      where: { id: researchId },
      select: {
        workflowInstance: {
          select: { workflow: { select: { createdBy: true } } },
        },
      },
    });
    if (
      project?.workflowInstance?.workflow.createdBy === userId ||
      !roles.includes("DEAN")
    )
      return "coordinator";
  }
  return roles.includes("DEAN") ? "dean" : "account";
}

type Delivery = {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  deduplicationKey: string;
  audience?: string;
};

/** Resolve generic project links using the recipient's actual assignments,
 * never the order of the recipient's institutional roles. */
export async function notificationDeliveries(
  tx: Prisma.TransactionClient,
  notifications: Delivery[],
) {
  const data: Prisma.NotificationCreateManyInput[] = [];
  const projectCache = new Map<
    string,
    Promise<{
      members: { userId: string; projectRole: string }[];
      workflowInstance: { workflow: { createdBy: string } } | null;
    } | null>
  >();
  for (const notification of notifications) {
    let audiences = notification.audience ? [notification.audience] : [];
    if (!audiences.length && notification.actionUrl) {
      const url = new URL(notification.actionUrl, "https://advisio.local");
      const direct = {
        student: "researcher",
        adviser: "adviser",
        panelist: "panelist",
        professor: "coordinator",
        admin: "dean",
        "system-admin": "system-admin",
      }[url.pathname.split("/")[1]];
      if (direct) audiences = [direct];
      const assignmentId = url.searchParams.get("assignmentId");
      if (!audiences.length && assignmentId) {
        const assignment = await tx.reviewerAssignment.findFirst({
          where: { id: assignmentId, reviewerId: notification.recipientId },
          select: { reviewType: true },
        });
        const audience = assignment && reviewAudience(assignment.reviewType);
        if (audience) audiences = [audience];
      }
      const projectId = url.searchParams.get("projectId");
      if (!audiences.length && !assignmentId && projectId) {
        if (!projectCache.has(projectId))
          projectCache.set(
            projectId,
            tx.researchProject.findUnique({
              where: { id: projectId },
              select: {
                members: {
                  where: { leftAt: null },
                  select: { userId: true, projectRole: true },
                },
                workflowInstance: {
                  select: { workflow: { select: { createdBy: true } } },
                },
              },
            }),
          );
        const project = await projectCache.get(projectId);
        audiences = (project?.members || [])
          .filter((member) => member.userId === notification.recipientId)
          .flatMap((member) => {
            const audience = {
              LEADER: "researcher",
              MEMBER: "researcher",
              ADVISER: "adviser",
              PANELIST: "panelist",
              COORDINATOR: "coordinator",
            }[member.projectRole];
            return audience ? [audience] : [];
          });
        if (
          project?.workflowInstance?.workflow.createdBy ===
          notification.recipientId
        )
          audiences.push("coordinator");
      }
    }
    if (!audiences.length)
      throw new Error(
        "Notification audience requires an explicit recipient responsibility.",
      );
    for (const audience of new Set(audiences)) {
      if (audience !== "account" && !getWorkspaceById(audience))
        throw new Error("Invalid notification audience.");
      data.push({
        ...notification,
        type: notification.type as Prisma.NotificationCreateManyInput["type"],
        audience,
        deduplicationKey: createHash("sha256")
          .update(
            `${notification.deduplicationKey}:${notification.recipientId}:${audience}`,
          )
          .digest("hex"),
      });
    }
  }
  return data;
}
