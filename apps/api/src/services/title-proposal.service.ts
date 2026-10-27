import { Prisma, prisma } from "../lib/prisma.js";
import { assertMilestoneCondition } from "./milestone-condition.service.js";
import { advanceMilestoneIfSatisfied } from "./research-workflow-integration.service.js";
import { hasActiveWorkflowEnrollment } from "./workflow-enrollment-access.service.js";

type Db = Prisma.TransactionClient;
function fail(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}
export function validateProposalTitles(
  value: unknown,
  count: number,
): string[] {
  if (
    !Array.isArray(value) ||
    value.length !== count ||
    value.some(
      (title) =>
        typeof title !== "string" ||
        title.trim().length < 5 ||
        title.trim().length > 500,
    )
  )
    fail(
      `Submit exactly ${count} titles, each between 5 and 500 characters.`,
      400,
    );
  const titles = (value as string[]).map((title) => title.trim());
  if (
    new Set(titles.map((title) => title.toLowerCase())).size !== titles.length
  )
    fail("Each proposed title must be different.", 400);
  return titles;
}
export function selectedProposalTitle(
  titles: string[],
  index: unknown,
): string {
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= titles.length
  )
    fail("Select one of the submitted titles.", 400);
  return titles[index];
}
export async function titleProposalContext(
  db: Db,
  researchId: string,
  stageId: string,
) {
  const initialStage = await db.workflowStage.findUnique({
    where: { id: stageId },
  });
  if (!initialStage) fail("Milestone not found.", 404);
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initialStage.workflowId}))`;
  const project = await db.researchProject.findUnique({
    where: { id: researchId },
    include: { members: { where: { leftAt: null } }, workflowInstance: true },
  });
  const stage = await db.workflowStage.findUnique({ where: { id: stageId } });
  if (
    !project ||
    !stage ||
    stage.milestoneType !== "TITLE_PROPOSAL" ||
    stage.category === "Archived" ||
    project.workflowInstance?.workflowId !== stage.workflowId
  )
    fail("Title Proposal milestone not found for this project.", 404);
  if (["ARCHIVED", "COMPLETED"].includes(project.status))
    fail("This project is closed.");
  return { project, stage };
}
export async function submitTitleProposals(options: {
  researchId: string;
  stageId: string;
  userId: string;
  titles: unknown;
}) {
  return prisma.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${options.researchId}))`;
    const { project, stage } = await titleProposalContext(
      db,
      options.researchId,
      options.stageId,
    );
    if (
      !project.members.some(
        (member) =>
          member.userId === options.userId && member.projectRole === "LEADER",
      ) ||
      !(await hasActiveWorkflowEnrollment(options.userId, stage.workflowId, db))
    )
      fail(
        "Only the actively enrolled project leader can submit title proposals.",
        403,
      );
    if (project.workflowInstance!.currentStageId !== stage.id)
      fail("Complete the preceding milestone first.");
    await assertMilestoneCondition(db, project.id, stage.id);
    const titles = validateProposalTitles(
      options.titles,
      stage.titleProposalCount,
    );
    const existing = await db.titleProposalSubmission.findUnique({
      where: {
        researchId_stageId: { researchId: project.id, stageId: stage.id },
      },
    });
    if (existing && existing.status !== "REVISION_REQUIRED")
      fail("This submission is already awaiting review or approved.");
    const saved = await db.titleProposalSubmission.upsert({
      where: {
        researchId_stageId: { researchId: project.id, stageId: stage.id },
      },
      create: {
        researchId: project.id,
        stageId: stage.id,
        titles,
        submittedBy: options.userId,
      },
      update: {
        titles,
        submittedBy: options.userId,
        status: "SUBMITTED",
        version: { increment: 1 },
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        selectedIndex: null,
      },
    });
    await db.auditLog.create({
      data: {
        userId: options.userId,
        action: "UPDATE",
        entityType: "TitleProposalSubmission",
        entityId: saved.id,
        oldValues: existing
          ? { titles: existing.titles, version: existing.version }
          : {},
        newValues: { titles, version: saved.version },
      },
    });
    const workflow = await db.workflow.findUnique({
      where: { id: stage.workflowId },
      select: { createdBy: true },
    });
    if (workflow && workflow.createdBy !== options.userId)
      await db.notification.create({
        data: {
          recipientId: workflow.createdBy,
          audience: "coordinator",
          type: "WORKFLOW_CHANGED",
          title: "Title proposals submitted",
          message:
            "Review the proposed titles and select one to register the research project.",
          entityType: "TitleProposalSubmission",
          entityId: saved.id,
          actionUrl: `/professor/dashboard?tab=submissions&workflowId=${stage.workflowId}`,
        },
      });
    return saved;
  });
}
export async function reviewTitleProposals(options: {
  researchId: string;
  stageId: string;
  reviewerId: string;
  version: unknown;
  status: unknown;
  selectedIndex?: unknown;
  reviewNote?: unknown;
}) {
  return prisma.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${options.researchId}))`;
    const { project, stage } = await titleProposalContext(
      db,
      options.researchId,
      options.stageId,
    );
    if (project.members.some((member) => member.userId === options.reviewerId))
      fail("You cannot review your own project's title proposals.", 403);
    await assertMilestoneCondition(db, project.id, stage.id);
    const submission = await db.titleProposalSubmission.findUnique({
      where: {
        researchId_stageId: { researchId: project.id, stageId: stage.id },
      },
    });
    if (!submission) fail("Submission not found.", 404);
    if (
      submission.status !== "SUBMITTED" ||
      submission.version !== options.version
    )
      fail(
        "This submission changed or was already reviewed. Refresh before reviewing.",
      );
    if (options.status !== "APPROVED" && options.status !== "REVISION_REQUIRED")
      fail("Choose approval or request revisions.", 400);
    const note =
      typeof options.reviewNote === "string"
        ? options.reviewNote.trim().slice(0, 2000)
        : "";
    if (options.status === "REVISION_REQUIRED" && !note)
      fail("Explain what the researcher needs to revise.", 400);
    const title =
      options.status === "APPROVED"
        ? selectedProposalTitle(submission.titles, options.selectedIndex)
        : null;
    if (title && project.registeredAt)
      fail("This project already has an approved registered title.");
    const updated = await db.titleProposalSubmission.update({
      where: { id: submission.id },
      data: {
        status: options.status,
        selectedIndex: title ? (options.selectedIndex as number) : null,
        reviewNote: note || null,
        reviewedBy: options.reviewerId,
        reviewedAt: new Date(),
      },
    });
    if (title) {
      await db.researchProject.update({
        where: { id: project.id },
        data: { title, workflowDraft: false, registeredAt: new Date(), status: "APPROVED" },
      });
      await db.auditLog.create({
        data: {
          userId: options.reviewerId,
          action: "UPDATE",
          entityType: "TitleProposalSubmission",
          entityId: submission.id,
          oldValues: { title: project.title },
          newValues: {
            title,
            selectedIndex: options.selectedIndex as number,
            version: submission.version,
          },
        },
      });
      await advanceMilestoneIfSatisfied(db, {
        researchId: project.id,
        milestoneId: stage.id,
        actorId: options.reviewerId,
      });
    }
    await db.notification.createMany({
      data: project.members
        .filter((member) => ["LEADER", "MEMBER"].includes(member.projectRole))
        .map((member) => ({
          recipientId: member.userId,
          audience: "researcher",
          type: "WORKFLOW_CHANGED" as const,
          title: title
            ? "Research title approved"
            : "Title proposals need revision",
          message: title
            ? `Your registered research project is “${title}”.`
            : note,
          entityType: "ResearchProject",
          entityId: project.id,
          actionUrl: `/student/tasks?projectId=${project.id}`,
        })),
    });
    return updated;
  });
}
