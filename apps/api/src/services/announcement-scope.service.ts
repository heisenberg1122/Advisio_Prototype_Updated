import type { Prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

export async function announcementScope(
  db: Prisma.TransactionClient,
  actor: AuthenticatedUser,
  input: { workflowId?: unknown; programId?: unknown },
) {
  const fail = (message: string, statusCode = 403): never => {
    throw Object.assign(new Error(message), { statusCode });
  };
  if (!actor.collegeId) fail("An assigned college is required.");
  const collegeId = actor.collegeId!;
  const actorName =
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
    "Your academic office";
  if (actor.roles.includes("DEAN") && !input.workflowId) {
    const programId =
      actor.programId ||
      (typeof input.programId === "string" ? input.programId : null);
    if (programId) {
      const program = await db.program.findFirst({
        where: { id: programId, collegeId },
        select: { name: true },
      });
      if (!program) fail("Department is outside your assigned college.");
      return {
        audienceCollegeId: actor.collegeId!,
        audienceProgramId: programId,
        audienceWorkflowId: null,
        scopeName: program!.name,
        actorName,
        recipients: {
          collegeId: actor.collegeId,
          programId,
        } satisfies Prisma.UserWhereInput,
      };
    }
    return {
      audienceCollegeId: actor.collegeId!,
      audienceProgramId: null,
      audienceWorkflowId: null,
      scopeName: "your college",
      actorName,
      recipients: {
        collegeId: actor.collegeId,
      } satisfies Prisma.UserWhereInput,
    };
  }
  if (
    !actor.roles.some((role) =>
      ["PROFESSOR", "RESEARCH_COORDINATOR", "DEAN"].includes(role),
    )
  )
    fail("Academic announcement access is required.");
  if (typeof input.workflowId !== "string" || !input.workflowId)
    fail("Select the workflow for this announcement.", 400);
  const workflow = await db.workflow.findFirst({
    where: {
      id: input.workflowId as string,
      createdBy: actor.id,
      status: "PUBLISHED",
      researchTypeId: {
        in: (
          await db.researchType.findMany({
            where: {
              program: {
                collegeId,
                ...(actor.programId ? { id: actor.programId } : {}),
              },
            },
            select: { id: true },
          })
        ).map((type) => type.id),
      },
    },
    select: { id: true, name: true },
  });
  if (!workflow)
    return fail("Published workflow not found in your academic scope.", 404);
  return {
    audienceCollegeId: actor.collegeId!,
    audienceProgramId: null,
    audienceWorkflowId: workflow.id,
    scopeName: workflow.name,
    actorName,
    recipients: {
      collegeId: actor.collegeId,
      OR: [
        {
          workflowEnrollments: {
            some: { workflowId: workflow.id, status: "ACTIVE" },
          },
        },
        {
          memberships: {
            some: {
              leftAt: null,
              projectRole: { in: ["ADVISER", "PANELIST", "COORDINATOR"] },
              research: { workflowInstance: { workflowId: workflow.id } },
            },
          },
        },
      ],
    } satisfies Prisma.UserWhereInput,
  };
}
