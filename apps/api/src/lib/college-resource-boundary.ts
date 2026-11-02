import type { Request } from "express";
import { prisma } from "./prisma.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ownership and project membership do not bypass the college selected for this session. */
export async function enforceCollegeResourceBoundary(req: Request) {
  if (!req.user || req.user.roles.includes("SYSTEM_ADMIN")) return;
  const path = req.originalUrl.split("?")[0];
  if (
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/account-invitations")
  )
    return;
  const check = (collegeId: string | null | undefined) => {
    if (collegeId && collegeId !== req.user!.collegeId)
      throw Object.assign(
        new Error(
          "This record belongs to another college. Switch to its authorized college first.",
        ),
        { statusCode: 403 },
      );
  };
  const researchIds = new Set<string>();
  const checkWorkflow = async (id: string) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      select: { researchTypeId: true },
    });
    if (workflow)
      check(
        (
          await prisma.researchType.findUnique({
            where: { id: workflow.researchTypeId },
            select: { program: { select: { collegeId: true } } },
          })
        )?.program.collegeId,
      );
  };
  for (const value of [
    req.params.researchId,
    req.body?.researchId,
    req.body?.groupId,
    req.query.researchId,
    req.query.groupId,
    req.query.projectId,
  ]) {
    if (typeof value === "string" && uuid.test(value)) researchIds.add(value);
  }
  const match = path.match(
    /^\/api\/(research|workspaces|workflows|documents|defense-sessions|defense-events|official-copies|reviewer-assignments)\/([0-9a-f-]{36})(?:\/|$)/i,
  );
  if (match && uuid.test(match[2])) {
    const id = match[2];
    switch (match[1]) {
      case "research":
        researchIds.add(id);
        break;
      case "workspaces":
        check(
          (
            await prisma.researchWorkspace.findUnique({
              where: { id },
              select: { collegeId: true },
            })
          )?.collegeId,
        );
        break;
      case "workflows":
        await checkWorkflow(id);
        break;
      case "documents":
        check(
          (
            await prisma.document.findUnique({
              where: { id },
              select: { research: { select: { collegeId: true } } },
            })
          )?.research.collegeId,
        );
        break;
      case "defense-sessions":
        check(
          (
            await prisma.defenseSession.findUnique({
              where: { id },
              select: { research: { select: { collegeId: true } } },
            })
          )?.research.collegeId,
        );
        break;
      case "defense-events":
        check(
          (
            await prisma.defenseEvent.findUnique({
              where: { id },
              select: { collegeId: true },
            })
          )?.collegeId,
        );
        break;
      case "official-copies":
        check(
          (
            await prisma.officialCopy.findUnique({
              where: { id },
              select: { research: { select: { collegeId: true } } },
            })
          )?.research.collegeId,
        );
        break;
      case "reviewer-assignments":
        check(
          (
            await prisma.reviewerAssignment.findUnique({
              where: { id },
              select: { research: { select: { collegeId: true } } },
            })
          )?.research.collegeId,
        );
        break;
    }
  }
  const version = path.match(
    /^\/api\/documents\/versions\/([0-9a-f-]{36})(?:\/|$)/i,
  );
  if (version && uuid.test(version[1]))
    check(
      (
        await prisma.documentVersion.findUnique({
          where: { id: version[1] },
          select: {
            document: { select: { research: { select: { collegeId: true } } } },
          },
        })
      )?.document.research.collegeId,
    );
  const task = path.match(/^\/api\/workflows\/tasks\/([0-9a-f-]{36})(?:\/|$)/i);
  if (task && uuid.test(task[1])) {
    const record = await prisma.workflowTask.findUnique({
      where: { id: task[1] },
      select: { stage: { select: { workflowId: true } } },
    });
    if (record) await checkWorkflow(record.stage.workflowId);
  }
  const child = path.match(
    /^\/api\/workflows\/(stages|topics|resources|stage-attachments|access|instances|enrollments)\/([0-9a-f-]{36})(?:\/|$)/i,
  );
  if (child && uuid.test(child[2])) {
    const id = child[2];
    let workflowId: string | undefined;
    switch (child[1]) {
      case "stages":
        workflowId = (
          await prisma.workflowStage.findUnique({
            where: { id },
            select: { workflowId: true },
          })
        )?.workflowId;
        break;
      case "topics":
        workflowId = (
          await prisma.workflowTopic.findUnique({
            where: { id },
            select: { workflowId: true },
          })
        )?.workflowId;
        break;
      case "resources":
        workflowId = (
          await prisma.workflowResource.findUnique({
            where: { id },
            select: { workflowId: true },
          })
        )?.workflowId;
        break;
      case "stage-attachments":
        workflowId = (
          await prisma.workflowStageAttachment.findUnique({
            where: { id },
            select: { stage: { select: { workflowId: true } } },
          })
        )?.stage.workflowId;
        break;
      case "access":
        workflowId = (
          await prisma.workflowAccessEntry.findUnique({
            where: { id },
            select: { workflowId: true },
          })
        )?.workflowId;
        break;
      case "instances":
        workflowId = (
          await prisma.workflowInstance.findUnique({
            where: { id },
            select: { workflowId: true },
          })
        )?.workflowId;
        break;
      case "enrollments":
        workflowId = (
          await prisma.workflowEnrollment.findUnique({
            where: { id },
            select: { workflowId: true },
          })
        )?.workflowId;
        break;
    }
    if (workflowId) await checkWorkflow(workflowId);
  }
  for (const id of [req.body?.workflowId, req.query.workflowId])
    if (typeof id === "string" && uuid.test(id)) await checkWorkflow(id);
  for (const id of [req.body?.documentId, req.query.documentId])
    if (typeof id === "string" && uuid.test(id))
      check(
        (
          await prisma.document.findUnique({
            where: { id },
            select: { research: { select: { collegeId: true } } },
          })
        )?.research.collegeId,
      );
  if (researchIds.size) {
    const projects = await prisma.researchProject.findMany({
      where: { id: { in: [...researchIds] } },
      select: { collegeId: true },
    });
    projects.forEach((project) => check(project.collegeId));
  }
}
