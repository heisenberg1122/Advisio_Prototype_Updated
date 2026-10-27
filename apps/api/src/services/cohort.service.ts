import { Prisma, prisma, type ResearchCohortStatus } from "../lib/prisma.js";
import { getCollegeScope } from "../lib/college-scope.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import type {
  CohortListQuery,
  CreateCohortInput,
  UpdateCohortInput,
} from "@research-management/validations";

export class CohortError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}
function fail(message: string, statusCode = 409): never {
  throw new CohortError(message, statusCode);
}

const managerRoles = ["SYSTEM_ADMIN", "DEAN", "RESEARCH_COORDINATOR"] as const;
const isManager = (user: AuthenticatedUser) =>
  managerRoles.some((role) => user.roles.includes(role));

function requireManager(user: AuthenticatedUser) {
  if (!isManager(user)) fail("You cannot manage research cohorts.", 403);
}

export function cohortScopeWhere(
  user: AuthenticatedUser,
): Prisma.ResearchCohortWhereInput {
  const scope = getCollegeScope(user);
  if (scope.kind === "unassigned")
    fail("An assigned college is required for cohort access.", 403);
  if (scope.kind === "institution") return {};
  if (user.roles.includes("DEAN")) return { collegeId: scope.collegeId };
  // Match the existing coordinator convention: a program assignment narrows college scope.
  const academicScope = {
    collegeId: scope.collegeId,
    ...(user.programId ? { programId: user.programId } : {}),
  };
  if (user.roles.includes("RESEARCH_COORDINATOR")) return academicScope;
  if (user.roles.includes("RESEARCHER"))
    return {
      ...academicScope,
      members: { some: { userId: user.id, status: "ACTIVE" } },
    };
  return fail("You cannot view research cohorts.", 403);
}

const personSelect = { id: true, firstName: true, lastName: true } as const;
const cohortInclude = {
  college: { select: { id: true, code: true, name: true } },
  program: { select: { id: true, code: true, name: true } },
  researchType: { select: { id: true, code: true, name: true } },
  academicYear: { select: { id: true, name: true } },
  // Cohort access does not grant legacy workflow resources, stages, or project access.
  workflow: {
    select: {
      id: true,
      name: true,
      version: true,
      status: true,
      researchTypeId: true,
    },
  },
  creator: { select: personSelect },
  _count: {
    select: {
      members: { where: { status: "ACTIVE" as const } },
      workspaces: true,
      researchProjects: true,
    },
  },
} satisfies Prisma.ResearchCohortInclude;
type Cohort = Prisma.ResearchCohortGetPayload<{
  include: typeof cohortInclude;
}>;
type Db = Prisma.TransactionClient;

async function scopedCohort(db: Db, user: AuthenticatedUser, id: string) {
  const cohort = await db.researchCohort.findFirst({
    where: { AND: [{ id }, cohortScopeWhere(user)] },
    include: cohortInclude,
  });
  if (!cohort) fail("Cohort not found in your academic scope.", 404);
  return cohort;
}

export async function listCohorts(
  user: AuthenticatedUser,
  query: CohortListQuery,
) {
  const { page, limit, ...filters } = query;
  const where: Prisma.ResearchCohortWhereInput = {
    AND: [cohortScopeWhere(user), filters],
  };
  const [cohorts, total] = await Promise.all([
    prisma.researchCohort.findMany({
      where,
      include: cohortInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.researchCohort.count({ where }),
  ]);
  return {
    cohorts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export function getCohort(user: AuthenticatedUser, id: string) {
  return scopedCohort(prisma, user, id);
}

async function validateAcademicContext(db: Db, identity: CreateCohortInput) {
  const [type, year] = await Promise.all([
    db.researchType.findFirst({
      where: {
        id: identity.researchTypeId,
        programId: identity.programId,
        isActive: true,
        program: {
          collegeId: identity.collegeId,
          isActive: true,
          college: { isActive: true },
        },
      },
      select: { id: true },
    }),
    db.academicYear.findFirst({
      where: { id: identity.academicYearId, isActive: true },
      select: { id: true },
    }),
  ]);
  if (!type || !year)
    fail(
      "Select an active research type, program, college, and academic year in the same academic scope.",
      400,
    );
}

async function publishedWorkflow(db: Db, cohort: Cohort, workflowId: string) {
  await validateAcademicContext(db, cohort);
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, status: true, researchTypeId: true },
  });
  if (!workflow) fail("Workflow not found.", 404);
  if (workflow.researchTypeId !== cohort.researchTypeId)
    fail(
      "The workflow must belong to the cohort's research type and academic scope.",
      400,
    );
  if (workflow.status !== "PUBLISHED")
    fail("Only a published workflow may be assigned to a cohort.");
  return workflow;
}

async function audit(
  db: Db,
  user: AuthenticatedUser,
  id: string,
  action: "CREATE" | "UPDATE",
  values: Prisma.InputJsonObject,
) {
  await db.auditLog.create({
    data: {
      userId: user.id,
      action,
      entityType: "ResearchCohort",
      entityId: id,
      newValues: values,
    },
  });
}

export async function createCohort(
  user: AuthenticatedUser,
  input: CreateCohortInput,
) {
  requireManager(user);
  cohortScopeWhere(user);
  const scope = getCollegeScope(user);
  if (
    scope.kind === "college" &&
    (input.collegeId !== scope.collegeId ||
      (!user.roles.includes("DEAN") &&
        user.programId &&
        input.programId !== user.programId))
  )
    fail("Create cohorts within your assigned academic scope.", 403);
  return prisma.$transaction(
    async (tx) => {
      await validateAcademicContext(tx, input);
      const cohort = await tx.researchCohort.create({
        data: {
          ...input,
          description: input.description ?? null,
          createdBy: user.id,
        },
        include: cohortInclude,
      });
      await audit(tx, user, cohort.id, "CREATE", {
        ...input,
        description: input.description ?? null,
        status: "DRAFT",
      });
      return cohort;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function mutateCohort<T>(
  user: AuthenticatedUser,
  id: string,
  operation: (tx: Db, cohort: Cohort) => Promise<T>,
) {
  requireManager(user);
  cohortScopeWhere(user);
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`research-cohort:${id}`}))`;
      return operation(tx, await scopedCohort(tx, user, id));
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

const transitions: Record<
  ResearchCohortStatus,
  readonly ResearchCohortStatus[]
> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["CLOSED", "ARCHIVED"],
  CLOSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export function updateCohort(
  user: AuthenticatedUser,
  id: string,
  input: UpdateCohortInput,
) {
  return mutateCohort(user, id, async (tx, cohort) => {
    if (cohort.status === "ARCHIVED") {
      if (Object.keys(input).length === 1 && input.status === "ARCHIVED")
        return cohort;
      fail("Archived cohorts are read-only.");
    }
    if (input.status && input.status !== cohort.status) {
      if (!transitions[cohort.status].includes(input.status))
        fail("This cohort status transition is not allowed.");
      if (input.status === "ACTIVE") {
        if (!cohort.workflowId)
          fail("Assign a published workflow before activating the cohort.");
        await publishedWorkflow(tx, cohort, cohort.workflowId);
      }
    }
    const updated = await tx.researchCohort.update({
      where: { id },
      data: input,
      include: cohortInclude,
    });
    await audit(tx, user, id, "UPDATE", {
      operation: "UPDATE_CONFIGURATION",
      previousStatus: cohort.status,
      ...input,
    });
    return updated;
  });
}

function requireOpen(cohort: Cohort) {
  if (cohort.status === "CLOSED" || cohort.status === "ARCHIVED")
    fail(
      "Membership and workflow assignment are locked for closed or archived cohorts.",
    );
}

export function assignCohortWorkflow(
  user: AuthenticatedUser,
  id: string,
  workflowId: string,
) {
  return mutateCohort(user, id, async (tx, cohort) => {
    requireOpen(cohort);
    await publishedWorkflow(tx, cohort, workflowId);
    if (workflowId === cohort.workflowId) return cohort;
    if (cohort._count.workspaces || cohort._count.researchProjects)
      fail(
        "A cohort with research workspaces or projects requires an explicit process migration.",
      );
    const updated = await tx.researchCohort.update({
      where: { id },
      data: { workflowId },
      include: cohortInclude,
    });
    await audit(tx, user, id, "UPDATE", {
      operation: "ASSIGN_WORKFLOW",
      previousWorkflowId: cohort.workflowId,
      workflowId,
    });
    return updated;
  });
}

export async function listCohortMembers(user: AuthenticatedUser, id: string) {
  // Authorize and read the roster in the same serializable snapshot.
  return prisma.$transaction(
    async (tx) => {
      await scopedCohort(tx, user, id);
      return tx.researchCohortMember.findMany({
        where: {
          cohortId: id,
          ...(!isManager(user) ? { status: "ACTIVE" as const } : {}),
        },
        include: { user: { select: personSelect } },
        orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export function addCohortMembers(
  user: AuthenticatedUser,
  id: string,
  userIds: string[],
) {
  return mutateCohort(user, id, async (tx, cohort) => {
    requireOpen(cohort);
    await validateAcademicContext(tx, cohort);
    const ids = [...new Set(userIds)];
    const eligible = await tx.user.findMany({
      where: {
        id: { in: ids },
        status: "ACTIVE",
        collegeId: cohort.collegeId,
        programId: cohort.programId,
        roles: { some: { role: { name: "RESEARCHER" } } },
      },
      select: { id: true },
    });
    if (eligible.length !== ids.length)
      fail(
        "Every selected account must be an active researcher in the cohort's college and program.",
        400,
      );
    const existing = await tx.researchCohortMember.findMany({
      where: { cohortId: id, userId: { in: ids } },
      include: { user: { select: personSelect } },
    });
    const changed: string[] = [];
    const members = [];
    for (const userId of ids) {
      const current = existing.find((member) => member.userId === userId);
      if (current?.status === "ACTIVE") {
        members.push(current);
        continue;
      }
      members.push(
        await tx.researchCohortMember.upsert({
          where: { cohortId_userId: { cohortId: id, userId } },
          create: { cohortId: id, userId },
          update: { status: "ACTIVE", removedAt: null, joinedAt: new Date() },
          include: { user: { select: personSelect } },
        }),
      );
      changed.push(userId);
    }
    if (changed.length)
      await audit(tx, user, id, "UPDATE", {
        operation: "ADD_RESEARCHERS",
        userIds: changed,
      });
    return members;
  });
}

export function removeCohortMember(
  user: AuthenticatedUser,
  id: string,
  userId: string,
) {
  return mutateCohort(user, id, async (tx, cohort) => {
    requireOpen(cohort);
    const current = await tx.researchCohortMember.findUnique({
      where: { cohortId_userId: { cohortId: id, userId } },
    });
    if (!current) fail("Cohort member not found.", 404);
    if (current.status === "REMOVED") return current;
    const removedAt = new Date();
    const member = await tx.researchCohortMember.update({
      where: { id: current.id },
      data: { status: "REMOVED", removedAt },
    });
    await audit(tx, user, id, "UPDATE", {
      operation: "REMOVE_RESEARCHER",
      userId,
      removedAt: removedAt.toISOString(),
    });
    return member;
  });
}
