import { createHash } from "node:crypto";
import type { Prisma } from "../lib/prisma.js";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { googleMeetUrl } from "./google-calendar.service.js";

export type ConsultationAccessContext = {
  collegeId: string | null;
  exists: boolean;
  isProjectCreator: boolean;
  isWorkflowOwner: boolean;
  activeProjectRoles: string[];
};

export function consultationAccessPolicy(
  user: AuthenticatedUser,
  context: ConsultationAccessContext,
) {
  if (user.collegeId !== context.collegeId) return { exists: context.exists, canView: false, canRequest: false, canApprove: false, isAssignedFaculty: false };
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
    (institutionalRoles.has("ADVISER") && projectRoles.has("ADVISER")) ||
    (institutionalRoles.has("RESEARCH_COORDINATOR") &&
      (context.isWorkflowOwner || projectRoles.has("COORDINATOR")));

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
  db: Pick<Prisma.TransactionClient, "researchProject"> = prisma,
) {
  const project = await db.researchProject.findUnique({
    where: { id: researchId },
    select: {
      id: true,
      title: true,
      groupName: true,
      status: true,
      collegeId: true,
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
    collegeId: project?.collegeId || null,
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
  const meetingUrl = joinableConsultationUrl(consultation);
  const requester = consultation.participants?.find((participant: { userId: string }) => participant.userId === consultation.createdBy)?.user;
  return {
    id: consultation.id,
    researchId: consultation.researchId,
    groupName: consultation.research?.groupName || consultation.research?.title || "Research Group",
    topic: consultation.title,
    title: consultation.title,
    adviser: consultation.research?.members?.filter((member: any) => !consultation.approverId || consultation.approverId === member.userId)
      .map((member: any) => `${member.user.firstName} ${member.user.lastName}`.trim()).join(", ") || "Assigned faculty",
    description: consultation.description,
    requesterName: requester ? `${requester.firstName} ${requester.lastName}`.trim() : undefined,
    date: new Date(consultation.scheduledStart).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
    time: new Date(consultation.scheduledStart).toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
    }),
    scheduledStart: consultation.scheduledStart,
    scheduledEnd: consultation.scheduledEnd,
    mode: meetingUrl ? "Google Meet" : "To be confirmed",
    meetingUrl: meetingUrl || "",
    meetingKind: String(consultation.meetingKind || "SCHEDULED").toLowerCase(),
    conferenceState: String(consultation.conferenceState || "LEGACY").toLowerCase(),
    calendarUpdatePending: Boolean(consultation.pendingCalendarUpdate),
    createdBy: consultation.createdBy,
    revision: consultation.revision,
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
  research: { select: { title: true, groupName: true, collegeId: true, status: true, members: { where: { projectRole: "ADVISER" as const, leftAt: null }, select: { userId: true, user: { select: { firstName: true, lastName: true } } } } } },
  participants: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  notes: { orderBy: { createdAt: "desc" as const }, take: 1 },
};

export function consultationAudience(user: AuthenticatedUser) {
  return {
    research: { collegeId: user.collegeId || "00000000-0000-0000-0000-000000000000" },
    participants: { some: { userId: user.id } },
  } satisfies Prisma.ConsultationWhereInput;
}

export function joinableConsultationUrl(consultation: {
  status: string;
  meetingUrl?: string | null;
  meetingKind?: string;
  scheduledEnd?: Date | string;
}, now = Date.now()) {
  if (!["SCHEDULED", "ONGOING"].includes(consultation.status)) return null;
  if (consultation.meetingKind === "INSTANT" && consultation.scheduledEnd &&
      new Date(consultation.scheduledEnd).getTime() <= now) return null;
  return googleMeetUrl(consultation.meetingUrl);
}
