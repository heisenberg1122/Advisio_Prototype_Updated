import { prisma, type Prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { cohortScopeWhere } from "./cohort.service.js";

type Db = Pick<Prisma.TransactionClient, "researchCohort">;

// Selection eligibility is separate from legacy enrollment/document authorization.
// This helper is read-only and never provisions projects, memberships, or enrollments.
export async function assignedCohortWorkflows(
  user: AuthenticatedUser,
  programId: string,
  options: {
    workflowId?: string;
    academicYearId?: string;
    cohortId?: string;
  } = {},
  db: Db = prisma,
) {
  // A multi-role account selecting as a researcher still needs its own cohort membership.
  const selectionUser: AuthenticatedUser = user.roles.includes("RESEARCHER")
    ? { ...user, roles: ["RESEARCHER"] }
    : user;
  const cohorts = await db.researchCohort.findMany({
    where: {
      AND: [
        cohortScopeWhere(selectionUser),
        {
          programId,
          status: "ACTIVE",
          ...(options.cohortId ? { id: options.cohortId } : {}),
          ...(options.academicYearId
            ? { academicYearId: options.academicYearId }
            : {}),
          workflowId: options.workflowId || { not: null },
          workflow: { is: { status: "PUBLISHED" } },
          program: { isActive: true, college: { isActive: true } },
          researchType: { isActive: true },
          academicYear: { isActive: true },
        },
      ],
    },
    select: {
      id: true,
      collegeId: true,
      programId: true,
      researchTypeId: true,
      workflowId: true,
      program: { select: { collegeId: true } },
      researchType: { select: { programId: true } },
      workflow: { select: { researchTypeId: true } },
      members: { where: { status: "ACTIVE" }, select: { userId: true } },
    },
  });
  // Independent foreign keys alone do not establish a consistent academic chain.
  return cohorts.filter(
    (cohort) =>
      cohort.workflowId &&
      cohort.workflow?.researchTypeId === cohort.researchTypeId &&
      cohort.researchType.programId === cohort.programId &&
      cohort.program.collegeId === cohort.collegeId,
  );
}
