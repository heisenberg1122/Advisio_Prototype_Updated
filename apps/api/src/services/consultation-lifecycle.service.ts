import { getEligibleWorkspaces } from "@research-management/auth";
import { z } from "zod";
import { Prisma, prisma } from "../lib/prisma.js";
import { FACULTY_COLLEGE_ROLES } from "../lib/college-authorization.js";
import {
  consultationInclude, consultationProjectAccess, joinableConsultationUrl,
} from "./consultation.service.js";
import {
  ConsultationCalendarError, googleCalendarService, googleMeetUrl,
} from "./google-calendar.service.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const consultationError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

type Project = { id: string; collegeId: string };
type Consultation = Prisma.ConsultationGetPayload<{ include: typeof consultationInclude }>;

export function recipientPolicy(project: Project, faculty: boolean): Prisma.UserWhereInput {
  const projectMembers: Prisma.UserWhereInput = {
    collegeId: project.collegeId,
    roles: { some: { role: { name: "RESEARCHER" } } },
    memberships: { some: { researchId: project.id, leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } } },
  };
  const facultyInCollege: Prisma.UserWhereInput = {
    collegeMemberships: { some: { collegeId: project.collegeId, roleNames: { hasSome: [...FACULTY_COLLEGE_ROLES] }, college: { isActive: true } } },
    ...(!faculty ? { memberships: { some: { researchId: project.id, leftAt: null, projectRole: "ADVISER" } } } : {}),
  };
  return { status: "ACTIVE", OR: [projectMembers, facultyInCollege] };
}

const recipientSelect = {
  id: true,
  firstName: true,
  lastName: true,
  collegeId: true,
  roles: { select: { role: { select: { name: true } } } },
  collegeMemberships: { select: { collegeId: true, roleNames: true } },
} satisfies Prisma.UserSelect;

export async function findConsultationRecipients(project: Project, faculty: boolean, filter: Prisma.UserWhereInput = {}, take?: number, db: Pick<Prisma.TransactionClient, "user"> = prisma) {
  return db.user.findMany({
    where: { AND: [recipientPolicy(project, faculty), filter] },
    select: recipientSelect,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    take,
  });
}

export function recipientWorkspaces(user: Prisma.UserGetPayload<{ select: typeof recipientSelect }>, collegeId: string) {
  const scopedRoles = user.collegeMemberships.find((membership) => membership.collegeId === collegeId)?.roleNames || [];
  const researcher = user.collegeId === collegeId && user.roles.some(({ role }) => role.name === "RESEARCHER");
  return getEligibleWorkspaces([...scopedRoles, ...(researcher ? ["RESEARCHER"] : [])]);
}

export async function notifyConsultation(
  tx: Prisma.TransactionClient,
  consultation: Pick<Consultation, "id" | "title" | "revision" | "research">,
  ids: string[],
  title: string,
) {
  if (!ids.length) return;
  const users = await tx.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: recipientSelect,
  });
  const data = users.flatMap((recipient) => recipientWorkspaces(recipient, consultation.research.collegeId).map((workspace) => ({
    recipientId: recipient.id,
    audience: workspace.id,
    type: "CONSULTATION_SCHEDULED" as const,
    title,
    message: consultation.title,
    entityType: "Consultation",
    entityId: consultation.id,
    actionUrl: workspace.id === "researcher" || workspace.id === "adviser"
      ? `${workspace.homeUrl}?tab=consultations&consultationId=${consultation.id}`
      : `${workspace.routePrefix}/consultations?consultationId=${consultation.id}`,
    deduplicationKey: `consultation:${consultation.id}:${consultation.revision}:${recipient.id}:${workspace.id}:${title}`,
  })));
  if (data.length) await tx.notification.createMany({ data, skipDuplicates: true });
}

export async function withConsultationLock<T>(
  id: string, operation: (tx: Prisma.TransactionClient, row: Consultation) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    // Lock the actual row so other writes, including adviser withdrawal, serialize with Calendar changes.
    await tx.$queryRaw`SELECT id FROM consultations WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await tx.consultation.findUnique({ where: { id }, include: consultationInclude });
    if (!row) throw consultationError(404, "Consultation not found.");
    return operation(tx, row);
  }, { timeout: 40_000, maxWait: 5_000 });
}

export function assertParticipant(row: Consultation, user: AuthenticatedUser) {
  if (!user.collegeId || row.research.collegeId !== user.collegeId ||
      !row.participants.some((participant) => participant.userId === user.id)) {
    throw consultationError(404, "Consultation not found.");
  }
}

export async function assertOrganizer(tx: Prisma.TransactionClient, row: Consultation, user: AuthenticatedUser, instant = false) {
  if (!user.collegeId || row.research.collegeId !== user.collegeId) {
    throw consultationError(404, "Consultation not found.");
  }
  const { access } = await consultationProjectAccess(user, row.researchId, tx);
  if (instant && row.meetingKind === "INSTANT" && row.createdBy === user.id && access.canRequest) return;
  const organizer = row.approverId ? row.approverId === user.id : row.createdBy === user.id;
  const legacy = row.conferenceState === "LEGACY" &&
    (row.research.members.some(({ userId }) => userId === user.id) ||
      (organizer && row.participants.some(({ userId }) => userId === user.id)));
  if (access.canApprove && (organizer || legacy)) return;
  throw consultationError(403, "Only the assigned consultation organizer can make this change.");
}

export function googleEventKey(consultationId: string) {
  return `advisio${consultationId.replaceAll("-", "").toLowerCase()}`;
}

export function consultationEventOptions(
  row: Consultation,
  participants = row.participants.map(({ user }) => user),
) {
  return {
    title: `Advisio Consultation: ${row.title}`,
    description: row.description,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    attendees: participants.map((user) => ({ email: user.email, displayName: `${user.firstName} ${user.lastName}` })),
    manualMeetingUrl: row.conferenceState === "MANUAL" || row.status === "PROVISIONING"
      ? googleMeetUrl(row.meetingUrl) || undefined
      : undefined,
  };
}

export async function provisionConsultation(id: string, user: AuthenticatedUser, range?: { start: Date; end: Date }) {
  // Persist the Calendar identity and any approved time before contacting Google.
  await withConsultationLock(id, async (tx, row) => {
    await assertOrganizer(tx, row, user, true);
    if (row.research.status === "ARCHIVED") throw consultationError(409, "Archived projects cannot schedule consultations.");
    if (["SCHEDULED", "ONGOING"].includes(row.status) && joinableConsultationUrl(row)) return;
    if (!["REQUESTED", "PROVISIONING"].includes(row.status)) {
      throw consultationError(409, "This consultation is no longer awaiting scheduling.");
    }
    if (range && row.status !== "REQUESTED" && (+range.start !== +row.scheduledStart || +range.end !== +row.scheduledEnd)) {
      throw consultationError(409, "Retry the current Google Calendar operation before changing its time.");
    }
    if (row.status === "REQUESTED") {
      if ((range?.end || row.scheduledEnd).getTime() <= Date.now()) {
        throw consultationError(409, "Choose a new time for this request before approving.");
      }
      await tx.consultation.update({
        where: { id },
        data: {
          approverId: user.id,
          status: "PROVISIONING",
          conferenceState: "PENDING",
          meetingUrl: null,
          googleEventId: googleEventKey(id),
          ...(range ? { scheduledStart: range.start, scheduledEnd: range.end } : {}),
          ...(!row.participants.some(({ userId }) => userId === user.id)
            ? { participants: { create: { userId: user.id } } } : {}),
        },
      });
    }
  });
  return withConsultationLock(id, async (tx, row) => {
    await assertOrganizer(tx, row, user, true);
    if (row.research.status === "ARCHIVED") throw consultationError(409, "Archived projects cannot schedule consultations.");
    if (["SCHEDULED", "ONGOING"].includes(row.status) && joinableConsultationUrl(row)) return { row };
    if (row.status !== "PROVISIONING") throw consultationError(409, "This consultation is no longer awaiting scheduling.");
    if (!row.googleEventId) throw consultationError(409, "This consultation is missing its Google Calendar event identity.");
    if (row.scheduledEnd.getTime() <= Date.now()) {
      throw consultationError(409, "This consultation time passed before Google Meet was ready. Cancel it and choose a new time.");
    }
    const eligible = await tx.user.count({
      where: {
        ...recipientPolicy({ id: row.researchId, collegeId: row.research.collegeId }, true),
        id: { in: row.participants.map(({ userId }) => userId) },
      },
    });
    if (eligible !== row.participants.length) {
      throw consultationError(409, "A participant is no longer eligible for this research group or college. Cancel and choose eligible participants.");
    }
    const options = consultationEventOptions(row);
    let meet;
    try {
      meet = await googleCalendarService.createMeetConsultation(row.googleEventId, options);
    } catch (error) {
      if (!(error instanceof ConsultationCalendarError)) throw error;
      const failed = await tx.consultation.update({
        where: { id }, data: { conferenceState: error.pending ? "PENDING" : "FAILED" }, include: consultationInclude,
      });
      return { row: failed, warning: error.message, failed: !error.pending };
    }
    const updated = await tx.consultation.update({
      where: { id },
      data: {
        meetingUrl: meet.meetingUrl,
        conferenceState: options.manualMeetingUrl ? "MANUAL" : "GOOGLE_VERIFIED",
        status: row.meetingKind === "INSTANT" ? "ONGOING" : "SCHEDULED",
        revision: { increment: 1 },
      },
      include: consultationInclude,
    });
    await notifyConsultation(tx, updated, updated.participants.map(({ userId }) => userId),
      row.approverId && row.approverId !== row.createdBy ? "Consultation approved and meeting ready" : "Consultation invitation and meeting ready");
    return { row: updated };
  });
}

export async function cancelWithdrawnAdviserConsultations(tx: Prisma.TransactionClient, researchId: string, adviserId: string) {
  const cancelled = await tx.consultation.updateManyAndReturn({
    where: {
      researchId, scheduledStart: { gt: new Date() },
      OR: [
        { status: "SCHEDULED" },
        { status: { in: ["REQUESTED", "PROVISIONING"] }, OR: [{ approverId: adviserId }, { createdBy: adviserId }] },
      ],
    },
    data: { status: "CANCELLED", pendingCalendarUpdate: Prisma.DbNull, calendarCancellationPending: true, revision: { increment: 1 } },
    select: { id: true },
  });
  const rows = await tx.consultation.findMany({
    where: { id: { in: cancelled.map(({ id }) => id) } }, include: consultationInclude,
  });
  for (const row of rows) {
    await notifyConsultation(tx, row, row.participants.map(({ userId }) => userId), "Consultation cancelled after adviser withdrawal");
  }
  return rows.length;
}

export async function syncConsultationCancellation(id: string) {
  await withConsultationLock(id, async (tx, row) => {
    if (!row.calendarCancellationPending) return;
    if (row.googleEventId) await googleCalendarService.cancelConsultation(row.googleEventId);
    await tx.consultation.update({ where: { id }, data: { calendarCancellationPending: false } });
  });
}

export const pendingCalendarUpdate = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  participantIds: z.array(z.string().uuid()),
});

export async function syncConsultationUpdate(id: string) {
  return withConsultationLock(id, async (tx, row) => {
    if (!row.pendingCalendarUpdate) return row;
    if (row.status !== "SCHEDULED" || row.research.status === "ARCHIVED" || !row.googleEventId) {
      throw consultationError(409, "This consultation is no longer available for Calendar updates.");
    }
    const update = pendingCalendarUpdate.parse(row.pendingCalendarUpdate);
    const scheduledStart = new Date(update.start);
    const scheduledEnd = new Date(update.end);
    const previousIds = row.participants.map(({ userId }) => userId);
    const removed = previousIds.filter((userId) => !update.participantIds.includes(userId));
    const added = update.participantIds.filter((userId) => !previousIds.includes(userId));
    const attendees = await tx.user.findMany({
      where: {
        ...recipientPolicy({ id: row.researchId, collegeId: row.research.collegeId }, true),
        id: { in: update.participantIds },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (attendees.length !== update.participantIds.length) {
      throw consultationError(409, "A participant is no longer eligible for this research group or college. Cancel and choose eligible participants.");
    }
    const options = { ...consultationEventOptions(row, attendees), scheduledStart, scheduledEnd };
    const legacy = row.conferenceState === "LEGACY";
    const meet = legacy ? await googleCalendarService.createMeetConsultation(row.googleEventId, options) : null;
    if (!legacy) await googleCalendarService.updateConsultation(row.googleEventId, options, row.meetingUrl);
    const changed = await tx.consultation.update({
      where: { id },
      data: {
        scheduledStart, scheduledEnd, pendingCalendarUpdate: Prisma.DbNull, revision: { increment: 1 },
        ...(meet ? { meetingUrl: meet.meetingUrl, conferenceState: "GOOGLE_VERIFIED" } : {}),
        participants: { deleteMany: { userId: { in: removed } }, create: added.map((userId) => ({ userId })) },
      },
      include: consultationInclude,
    });
    await notifyConsultation(tx, changed, update.participantIds,
      +scheduledStart !== +row.scheduledStart || +scheduledEnd !== +row.scheduledEnd ? "Consultation rescheduled" : "Consultation participants updated");
    await notifyConsultation(tx, changed, removed, "Consultation invitation removed");
    return changed;
  });
}

export function startConsultationCalendarWorker() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await prisma.consultation.updateMany({
        where: { meetingKind: "INSTANT", status: "ONGOING", scheduledEnd: { lte: new Date() } },
        data: { status: "COMPLETED", revision: { increment: 1 } },
      });
      const waiting = { OR: [{ calendarCancellationPending: true }, { pendingCalendarUpdate: { not: Prisma.DbNull } }] };
      const rows = await prisma.consultation.findMany({
        where: waiting, orderBy: { updatedAt: "asc" }, take: 10, select: { id: true, calendarCancellationPending: true },
      });
      for (const { id, calendarCancellationPending } of rows) {
        try {
          if (calendarCancellationPending) await syncConsultationCancellation(id);
          else await syncConsultationUpdate(id);
        } catch {
          // Keep failed rows behind other pending Calendar operations.
          await prisma.consultation.updateMany({
            where: { id, ...waiting }, data: { updatedAt: new Date() },
          });
          console.warn("A consultation Calendar operation is awaiting retry.");
        }
      }
    } catch {
      console.warn("Consultation Calendar processing is unavailable.");
    } finally {
      running = false;
    }
  }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
