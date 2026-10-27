import { z } from "zod";
import { Prisma, prisma } from "../lib/prisma.js";

const inputSchema = z
  .object({
    cohortId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    actorId: z.string().uuid(),
  })
  .strict();

export type ProvisionResearchCaseInput = z.infer<typeof inputSchema>;
export type ResearchCaseProvisioningErrorCode =
  | "INVALID_PROVISIONING_INPUT"
  | "COHORT_NOT_FOUND"
  | "COHORT_NOT_ACTIVE"
  | "COHORT_PROCESS_NOT_ASSIGNED"
  | "COHORT_PROCESS_NOT_FOUND"
  | "COHORT_PROCESS_NOT_PUBLISHED"
  | "WORKSPACE_NOT_FOUND"
  | "WORKSPACE_COHORT_MISMATCH"
  | "ACTOR_NOT_COHORT_MEMBER"
  | "ACTOR_NOT_WORKSPACE_MEMBER"
  | "ACTOR_NOT_WORKSPACE_LEADER"
  | "TEAM_MEMBER_NOT_IN_COHORT"
  | "TEAM_MEMBER_NOT_ELIGIBLE"
  | "INVALID_TEAM_LEADERSHIP"
  | "WORKFLOW_ACCESS_REVOKED"
  | "WORKFLOW_ACCESS_MISSING"
  | "INVALID_ACADEMIC_SCOPE"
  | "NO_ACTIVE_WORKFLOW_STAGE"
  | "MULTIPLE_RESEARCH_CASES"
  | "EXISTING_CASE_INCONSISTENT";

export class ResearchCaseProvisioningError extends Error {
  constructor(public readonly code: ResearchCaseProvisioningErrorCode) {
    super(code);
    this.name = "ResearchCaseProvisioningError";
  }
}

function fail(code: ResearchCaseProvisioningErrorCode): never {
  throw new ResearchCaseProvisioningError(code);
}

// This is an internal capability only. Legacy registration/participation are not
// callers: their title, workspace, enrollment, and actor contracts differ.
export async function provisionResearchCase(input: ProvisionResearchCaseInput) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) fail("INVALID_PROVISIONING_INPUT");
  const { cohortId, workspaceId, actorId } = parsed.data;

  // PostgreSQL may abort a serializable snapshot taken while waiting for a lock.
  // Retrying the entire transaction makes the losing caller see the completed case.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`research-cohort:${cohortId}`}))`;
          const cohort = await tx.researchCohort.findUnique({
            where: { id: cohortId },
            select: {
              id: true,
              status: true,
              collegeId: true,
              programId: true,
              researchTypeId: true,
              academicYearId: true,
              workflowId: true,
              college: { select: { isActive: true } },
              program: { select: { isActive: true, collegeId: true } },
              // Deliberately never select the deprecated research-type workflow pointer.
              researchType: { select: { isActive: true, programId: true } },
              academicYear: { select: { isActive: true } },
              members: {
                where: { status: "ACTIVE" },
                select: { userId: true },
              },
            },
          });
          if (!cohort) fail("COHORT_NOT_FOUND");
          if (cohort.status !== "ACTIVE") fail("COHORT_NOT_ACTIVE");
          if (!cohort.workflowId) fail("COHORT_PROCESS_NOT_ASSIGNED");
          if (
            !cohort.college.isActive ||
            !cohort.program.isActive ||
            !cohort.researchType.isActive ||
            !cohort.academicYear.isActive ||
            cohort.program.collegeId !== cohort.collegeId ||
            cohort.researchType.programId !== cohort.programId
          )
            fail("INVALID_ACADEMIC_SCOPE");

          // Share the enrollment-management/participation lock. Workspace deletion
          // and legacy registration also use the workspace lock below.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workflow-access:${cohort.workflowId}`}))`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;
          const workflow = await tx.workflow.findUnique({
            where: { id: cohort.workflowId },
            select: {
              id: true,
              status: true,
              researchTypeId: true,
              version: true,
              stages: {
                where: { category: { not: "Archived" } },
                orderBy: { sequence: "asc" },
                take: 1,
                select: { id: true },
              },
            },
          });
          if (!workflow) fail("COHORT_PROCESS_NOT_FOUND");
          if (workflow.status !== "PUBLISHED")
            fail("COHORT_PROCESS_NOT_PUBLISHED");
          if (workflow.researchTypeId !== cohort.researchTypeId)
            fail("INVALID_ACADEMIC_SCOPE");
          const workspace = await tx.researchWorkspace.findUnique({
            where: { id: workspaceId },
            include: {
              members: {
                where: { leftAt: null },
                include: {
                  user: {
                    select: {
                      status: true,
                      collegeId: true,
                      programId: true,
                      roles: { select: { role: { select: { name: true } } } },
                    },
                  },
                },
              },
            },
          });
          if (!workspace) fail("WORKSPACE_NOT_FOUND");
          if (workspace.cohortId !== cohort.id)
            fail("WORKSPACE_COHORT_MISMATCH");
          if (
            workspace.programId !== cohort.programId ||
            workspace.collegeId !== cohort.collegeId
          )
            fail("INVALID_ACADEMIC_SCOPE");
          const cohortMembers = new Set(
            cohort.members.map((member) => member.userId),
          );
          if (!cohortMembers.has(actorId)) fail("ACTOR_NOT_COHORT_MEMBER");
          const actor = workspace.members.find(
            (member) => member.userId === actorId,
          );
          if (!actor) fail("ACTOR_NOT_WORKSPACE_MEMBER");
          if (actor.role !== "LEADER") fail("ACTOR_NOT_WORKSPACE_LEADER");
          if (
            workspace.members.filter((member) => member.role === "LEADER")
              .length !== 1 ||
            (workspace.participationMode === "SOLO" &&
              workspace.members.length !== 1)
          )
            fail("INVALID_TEAM_LEADERSHIP");
          for (const member of workspace.members) {
            if (!cohortMembers.has(member.userId))
              fail("TEAM_MEMBER_NOT_IN_COHORT");
            if (
              member.user.status !== "ACTIVE" ||
              member.user.programId !== cohort.programId ||
              member.user.collegeId !== cohort.collegeId ||
              !member.user.roles.some(({ role }) => role.name === "RESEARCHER")
            )
              fail("TEAM_MEMBER_NOT_ELIGIBLE");
          }

          // Include archived cases. A retry must not manufacture a replacement.
          // There is no new uniqueness constraint on historically multi-project workspaces.
          const existing = await tx.researchProject.findMany({
            where: { cohortId, workspaceId },
            take: 2,
            include: { workflowInstance: true },
          });
          if (existing.length > 1) fail("MULTIPLE_RESEARCH_CASES");
          const prior = existing[0];
          if (
            prior &&
            (!prior.workflowInstance ||
              prior.workflowInstance.researchId !== prior.id ||
              prior.collegeId !== cohort.collegeId ||
              prior.programId !== cohort.programId ||
              prior.researchTypeId !== cohort.researchTypeId ||
              prior.academicYearId !== cohort.academicYearId)
          )
            fail("EXISTING_CASE_INCONSISTENT");
          const workflowId = prior?.workflowInstance?.workflowId ?? workflow.id;
          const participantIds = workspace.members.map(
            (member) => member.userId,
          );
          const enrollmentWhere = {
            workflowId,
            userId: { in: participantIds },
          };
          const enrollments = await tx.workflowEnrollment.findMany({
            where: enrollmentWhere,
          });
          if (enrollments.some((enrollment) => enrollment.status !== "ACTIVE"))
            fail("WORKFLOW_ACCESS_REVOKED");
          if (prior) {
            // A repeat call is read-only: it does not synchronize changed team rosters
            // or restore deleted/revoked authorization on an existing case.
            if (enrollments.length !== participantIds.length)
              fail("WORKFLOW_ACCESS_MISSING");
            const { workflowInstance, ...project } = prior;
            return {
              project,
              workflowInstance: workflowInstance!,
              created: false,
            };
          }
          if (!workflow.stages.length) fail("NO_ACTIVE_WORKFLOW_STAGE");
          const enrolledIds = new Set(
            enrollments.map((enrollment) => enrollment.userId),
          );
          const missingIds = participantIds.filter(
            (id) => !enrolledIds.has(id),
          );

          const project = await tx.researchProject.create({
            data: {
              collegeId: cohort.collegeId,
              programId: cohort.programId,
              researchTypeId: cohort.researchTypeId,
              academicYearId: cohort.academicYearId,
              cohortId,
              workspaceId,
              createdBy: actorId,
              status: "DRAFT",
              title: workspace.name.trim()
                ? `${workspace.name.trim()} Research Study`
                : "Untitled Research Study",
              isTitleProvisional: true,
              workflowDraft: true,
              registeredAt: null,
              groupName:
                workspace.participationMode === "GROUP" ? workspace.name : null,
              participationMode: workspace.participationMode,
              accessMode:
                workspace.participationMode === "GROUP"
                  ? workspace.accessMode
                  : "INVITE_ONLY",
            },
          });
          await tx.researchMember.createMany({
            data: workspace.members.map((member) => ({
              researchId: project.id,
              userId: member.userId,
              projectRole: member.role,
            })),
          });
          if (missingIds.length) {
            // Never update an existing row, including a concurrently inserted denial.
            await tx.workflowEnrollment.createMany({
              data: missingIds.map((userId) => ({
                workflowId,
                userId,
                status: "ACTIVE",
              })),
              skipDuplicates: true,
            });
            const current = await tx.workflowEnrollment.findMany({
              where: enrollmentWhere,
            });
            if (current.some((enrollment) => enrollment.status !== "ACTIVE"))
              fail("WORKFLOW_ACCESS_REVOKED");
            if (current.length !== participantIds.length)
              fail("WORKFLOW_ACCESS_MISSING");
          }
          const workflowInstance = await tx.workflowInstance.create({
            data: {
              researchId: project.id,
              workflowId,
              workflowVersion: workflow.version,
              currentStageId: workflow.stages[0].id,
            },
          });
          const linked = await tx.researchProject.update({
            where: { id: project.id },
            data: { workflowInstanceId: workflowInstance.id },
          });
          await tx.auditLog.create({
            data: {
              userId: actorId,
              action: "CREATE",
              entityType: "ResearchProject",
              entityId: project.id,
              newValues: {
                operation: "RESEARCH_CASE_PROVISIONED",
                researchId: project.id,
                cohortId,
                workspaceId,
                workflowId,
                actorId,
              },
            },
          });
          return { project: linked, workflowInstance, created: true };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034" ||
        attempt >= 4
      )
        throw error;
    }
  }
}
