import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

export async function resolveRegistrationWorkflow(
  user: AuthenticatedUser,
  programId: string,
  requestedWorkflowId?: string,
  requestedResearchTypeId?: string,
) {
  function fail(message: string, statusCode = 400): never {
    throw Object.assign(new Error(message), { statusCode });
  }
  const include = {
    stages: {
      where: { category: { not: "Archived" } },
      orderBy: { sequence: "asc" as const },
      include: {
        topic: true,
        tasks: { orderBy: { sequence: "asc" as const } },
      },
    },
  };
  if (user.roles.includes("RESEARCHER")) {
    const enrollments = await prisma.workflowEnrollment.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        ...(requestedWorkflowId ? { workflowId: requestedWorkflowId } : {}),
      },
      include: { workflow: { include } },
    });
    const types = await prisma.researchType.findMany({
      where: {
        programId,
        isActive: true,
        program: { isActive: true, college: { isActive: true } },
      },
    });
    const eligible = enrollments.filter(
      ({ workflow }) =>
        workflow.status === "PUBLISHED" &&
        types.some((type) => type.id === workflow.researchTypeId) &&
        (!requestedResearchTypeId ||
          workflow.researchTypeId === requestedResearchTypeId),
    );
    if (!eligible.length)
      fail(
        "Join an active workflow for your program before registering your research project.",
      );
    if (eligible.length !== 1)
      fail("Select the workflow for this research project.");
    return {
      researchType: types.find(
        (type) => type.id === eligible[0].workflow.researchTypeId,
      )!,
      workflow: eligible[0].workflow,
    };
  }
  const researchTypes = await prisma.researchType.findMany({
    where: {
      programId,
      isActive: true,
      ...(requestedResearchTypeId ? { id: requestedResearchTypeId } : {}),
    },
    include: { workflow: { include } },
    take: 2,
  });
  if (researchTypes.length !== 1)
    fail("Select an active research type within the project's program.");
  const researchType = researchTypes[0];
  const workflow = requestedWorkflowId
    ? await prisma.workflow.findFirst({
        where: {
          id: requestedWorkflowId,
          researchTypeId: researchType.id,
          status: "PUBLISHED",
        },
        include,
      })
    : researchType.workflow;
  if (requestedWorkflowId && !workflow)
    fail("The selected workflow is unavailable for this research type.");
  if (
    workflow &&
    (workflow.researchTypeId !== researchType.id ||
      workflow.status !== "PUBLISHED")
  )
    fail("The research type's workflow is unavailable.");
  return { researchType, workflow };
}
