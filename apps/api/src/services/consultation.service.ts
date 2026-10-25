import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

export type ConsultationAccessContext = {
  exists: boolean;
  isProjectCreator: boolean;
  isWorkflowOwner: boolean;
  activeProjectRoles: string[];
};

export function consultationAccessPolicy(
  user: AuthenticatedUser,
  context: ConsultationAccessContext,
) {
  const institutionalRoles = new Set(user.roles);
  const projectRoles = new Set(context.activeProjectRoles);
  if (user.researcherPanel) {
    const isResearcher = projectRoles.has("LEADER") || projectRoles.has("MEMBER");
    return {
      exists: context.exists,
      canView: context.exists && isResearcher,
      canRequest: context.exists && isResearcher,
      canApprove: false,
      isAssignedFaculty: false,
    };
  }
  const isAdministrator = institutionalRoles.has("SYSTEM_ADMIN");
  const isProjectMember = [
    "LEADER",
    "MEMBER",
    "ADVISER",
    "PANELIST",
    "COORDINATOR",
  ].some((role) => projectRoles.has(role));
  const isAssignedFaculty =
    context.isWorkflowOwner ||
    projectRoles.has("ADVISER") ||
    projectRoles.has("COORDINATOR");

  return {
    exists: context.exists,
    canView: context.exists && (isAdministrator || isProjectMember || isAssignedFaculty),
    canRequest: context.exists && (isProjectMember || isAssignedFaculty),
    canApprove: context.exists && isAssignedFaculty,
    isAssignedFaculty,
  };
}

export async function consultationProjectAccess(
  user: AuthenticatedUser,
  researchId: string,
) {
  const project = await prisma.researchProject.findUnique({
    where: { id: researchId },
    select: {
      id: true,
      title: true,
      createdBy: true,
      members: {
        where: { userId: user.id, leftAt: null },
        select: { projectRole: true },
      },
      workflowInstance: {
        select: { workflow: { select: { createdBy: true } } },
      },
    },
  });

  const access = consultationAccessPolicy(user, {
    exists: Boolean(project),
    isProjectCreator: project?.createdBy === user.id,
    isWorkflowOwner: project?.workflowInstance?.workflow.createdBy === user.id,
    activeProjectRoles: project?.members.map((member) => member.projectRole) || [],
  });
  return { project, access };
}

export function legacyConsultationImportKey(input: {
  userId: string;
  researchId: string;
  clientId: string;
}) {
  return createHash("sha256")
    .update(`${input.userId}:${input.researchId}:${input.clientId}`)
    .digest("hex");
}

export function serializeConsultation(consultation: any) {
  const latestNote = consultation.notes?.[0] || null;
  return {
    id: consultation.id,
    researchId: consultation.researchId,
    groupName: consultation.research?.title || "Research Group",
    topic: consultation.title,
    title: consultation.title,
    adviser: consultation.research?.members?.map((member: any) => `${member.user.firstName} ${member.user.lastName}`.trim()).join(", ") || "Assigned faculty",
    description: consultation.description,
    date: new Date(consultation.scheduledStart).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
    time: new Date(consultation.scheduledStart).toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
    }),
    scheduledStart: consultation.scheduledStart,
    scheduledEnd: consultation.scheduledEnd,
    mode: consultation.meetingUrl ? "Google Meet" : "To be confirmed",
    meetingUrl: consultation.meetingUrl || "",
    status: String(consultation.status).toLowerCase(),
    participants: consultation.participants || [],
    notes: latestNote?.notes || "",
    actionItems: latestNote?.actionItems || [],
    transcript: latestNote?.transcript || [],
    createdAt: consultation.createdAt,
    updatedAt: consultation.updatedAt,
  };
}

export const consultationInclude = {
  research: { select: { title: true, members: { where: { projectRole: "ADVISER" as const, leftAt: null }, select: { user: { select: { firstName: true, lastName: true } } } } } },
  participants: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  notes: { orderBy: { createdAt: "desc" as const }, take: 1 },
};
