import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { assignedCohortWorkflows } from "./cohort-workflow-selection.service.js";

export async function resolveRegistrationWorkflow(
  user: AuthenticatedUser,
  programId: string,
  requestedWorkflowId?: string,
  requestedResearchTypeId?: string,
  context: {
    academicYearId?: string;
    cohortId?: string;
    existingWorkflowId?: string;
  } = {},
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
    // A pinned draft may be promoted without reassigning an already-running legacy process.
    const pinnedWorkflowId =
      context.existingWorkflowId &&
      (!requestedWorkflowId ||
        requestedWorkflowId === context.existingWorkflowId)
        ? context.existingWorkflowId
        : undefined;
    const assignments = pinnedWorkflowId
      ? []
      : await assignedCohortWorkflows(user, programId, {
          workflowId: requestedWorkflowId,
          academicYearId: context.academicYearId,
          cohortId: context.cohortId,
        });
    const assignedIds = new Set(assignments.map((cohort) => cohort.workflowId));
    const eligible = enrollments.filter(
      ({ workflow }) =>
        workflow.status === "PUBLISHED" &&
        (workflow.id === pinnedWorkflowId || assignedIds.has(workflow.id)) &&
        types.some((type) => type.id === workflow.researchTypeId) &&
        (!requestedResearchTypeId ||
          workflow.researchTypeId === requestedResearchTypeId),
    );
    if (!eligible.length)
      fail(
        "Join an active workflow assigned to one of your active cohorts before registering your research project.",
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
    : null;
  if (requestedWorkflowId && !workflow)
    fail("The selected workflow is unavailable for this research type.");
  if (
    workflow &&
    !(
      await assignedCohortWorkflows(user, programId, {
        workflowId: workflow.id,
        academicYearId: context.academicYearId,
        cohortId: context.cohortId,
      })
    ).length
  )
    fail(
      "Assign this published workflow to an active cohort in the project's academic scope.",
    );
  return { researchType, workflow };
}
