import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

type EnrollmentDatabase = Pick<Prisma.TransactionClient, "workflowEnrollment">;

export async function hasActiveWorkflowEnrollment(
  userId: string,
  workflowId: string,
  db: EnrollmentDatabase = prisma,
) {
  return Boolean(
    await db.workflowEnrollment.findFirst({
      where: { userId, workflowId, status: "ACTIVE" },
      select: { id: true },
    }),
  );
}

// Project membership grants project access, not access to a professor's workflow.
export async function filterResearchWorkflowDetails<
  T extends {
    workflowInstance?: { workflowId: string } | null;
  },
>(user: AuthenticatedUser, projects: T[]) {
  if (!user.roles.includes("RESEARCHER")) return projects;
  const workflowIds = [
    ...new Set(
      projects.flatMap((project) =>
        project.workflowInstance ? [project.workflowInstance.workflowId] : [],
      ),
    ),
  ];
  if (!workflowIds.length) return projects;
  const enrollments = await prisma.workflowEnrollment.findMany({
    where: {
      userId: user.id,
      workflowId: { in: workflowIds },
      status: "ACTIVE",
    },
    select: { workflowId: true },
  });
  const allowed = new Set(
    enrollments.map((enrollment) => enrollment.workflowId),
  );
  return projects.map((project) => {
    if (
      !project.workflowInstance ||
      allowed.has(project.workflowInstance.workflowId)
    )
      return project;
    return {
      ...project,
      workflowInstance: null,
      taskSubmissions: [],
      workflowAccessRemoved: true,
    };
  });
}
