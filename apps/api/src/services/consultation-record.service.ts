import { z } from "zod";
import { prisma, type ConsultationRecord, type Prisma } from "../lib/prisma.js";
import { FACULTY_COLLEGE_ROLES } from "../lib/college-authorization.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import {
  consultationInclude, coordinatorConsultationProjects, coordinatorConsultationRoles,
} from "./consultation.service.js";
import { consultationError, notifyConsultation, withConsultationLock } from "./consultation-lifecycle.service.js";

type Consultation = Prisma.ConsultationGetPayload<{ include: typeof consultationInclude }>;
const nameOf = (user: { firstName: string; lastName: string }) =>
  `${user.firstName} ${user.lastName}`.trim();

export const consultationProofSelect = {
  actualStart: true, actualEnd: true, submittedBy: true, submittedAt: true,
  reviewer: true, reviewedAt: true, correction: true, reviewerId: true, submittedById: true,
} satisfies Prisma.ConsultationRecordSelect;
type ProofFields = Prisma.ConsultationRecordGetPayload<{ select: typeof consultationProofSelect }>;

export function consultationProof(id: string, record: ProofFields | null, viewerId?: string) {
  if (!record) return null;
  if (record.correction) return { status: "correction_requested" as const, ...(viewerId === record.submittedById && { needsAction: true }) };
  if (!record.reviewedAt) return { status: "awaiting_confirmation" as const, ...(viewerId === record.reviewerId && { needsAction: true }) };
  return {
    status: "confirmed" as const,
    reference: `CR-${id.toUpperCase()}`,
    actualStart: record.actualStart,
    actualEnd: record.actualEnd,
    durationMinutes: Math.max(1, Math.round((+record.actualEnd - +record.actualStart) / 60_000)),
    submittedBy: record.submittedBy,
    submittedAt: record.submittedAt,
    confirmedBy: record.reviewer,
    confirmedAt: record.reviewedAt,
  };
}

function recordable(row: Consultation) {
  return row.status === "COMPLETED" ||
    (["SCHEDULED", "ONGOING"].includes(row.status) && row.scheduledStart <= new Date() && !row.pendingCalendarUpdate);
}

function legacyAdviser(row: Consultation, userId: string) {
  return row.conferenceState === "LEGACY" && !row.approverId &&
    row.research.members.length === 1 && row.research.members[0].userId === userId;
}

async function access(db: Prisma.TransactionClient, row: Consultation, user: AuthenticatedUser) {
  if (!user.collegeId || row.research.collegeId !== user.collegeId) {
    throw consultationError(404, "Consultation not found.");
  }
  const participant = row.participants.some(({ userId }) => userId === user.id);
  const assignedLegacyAdviser = user.roles.includes("ADVISER") && legacyAdviser(row, user.id);
  const oversees = !user.researcherPanel && (user.roles.includes("DEAN") ||
    (user.roles.some((role) => coordinatorConsultationRoles.includes(role)) &&
      Boolean(await db.researchProject.findFirst({
        where: { id: row.researchId, ...coordinatorConsultationProjects(user.id, user.collegeId) },
        select: { id: true },
      }))));
  if (!participant && !assignedLegacyAdviser && !oversees) {
    throw consultationError(404, "Consultation not found.");
  }
  return { participant, assignedLegacyAdviser };
}

async function recordSigners(db: Prisma.TransactionClient, row: Consultation, previousReviewerId?: string) {
  const invited = row.participants.map(({ userId }) => userId);
  const legacy = row.research.members.find(({ userId }) => legacyAdviser(row, userId))?.userId;
  const people = await db.user.findMany({
    where: { id: { in: legacy ? [...invited, legacy] : invited }, status: "ACTIVE" },
    select: {
      id: true, firstName: true, lastName: true, collegeId: true,
      roles: { select: { role: { select: { name: true } } } },
      collegeMemberships: {
        where: { collegeId: row.research.collegeId, college: { isActive: true } },
        select: { roleNames: true },
      },
    },
  });
  const faculty = people.filter((person) => person.collegeMemberships.some(({ roleNames }) =>
    FACULTY_COLLEGE_ROLES.some((role) => roleNames.includes(role))));
  const organizer = faculty.find(({ id }) => id === (row.approverId ?? row.createdBy)) ??
    (!row.approverId ? faculty.find(({ id }) => row.research.members.some(({ userId }) => userId === id)) : undefined);
  const otherInvitees = people.filter(({ id }) => id !== organizer?.id && invited.includes(id));
  const researchers = otherInvitees.filter((person) => person.collegeId === row.research.collegeId &&
    person.roles.some(({ role }) => role.name === "RESEARCHER"));
  const requester = researchers.find(({ id }) => id === row.createdBy);
  const reviewers = requester ? [requester] : researchers.length ? researchers :
    otherInvitees.filter(({ id }) => faculty.some((person) => person.id === id));
  const previousReviewer = reviewers.find(({ id }) => id === previousReviewerId);
  return { organizer, reviewers: previousReviewer ? [previousReviewer] : reviewers };
}

async function recordView(
  db: Prisma.TransactionClient, row: Consultation, user: AuthenticatedUser,
  record: ConsultationRecord | null, viewer: Awaited<ReturnType<typeof access>>,
) {
  const proof = consultationProof(row.id, record);
  const signer = Boolean(record && (user.id === record.submittedById || user.id === record.reviewerId));
  const canRead = signer || (viewer.participant && proof?.status === "confirmed");
  const maySubmit = !user.researcherPanel && recordable(row) && (!record || Boolean(record.correction)) &&
    (viewer.participant || viewer.assignedLegacyAdviser) && (!record || record.submittedById === user.id);
  const signers = maySubmit ? await recordSigners(db, row, record?.reviewerId) : null;
  const reviewers = signers?.organizer?.id === user.id ? signers.reviewers.map((person) => ({
    id: person.id, name: nameOf(person),
  })) : [];
  return {
    title: row.title,
    project: row.research.title,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    proof,
    reviewers,
    canReview: Boolean(record && !record.reviewedAt && record.reviewerId === user.id && viewer.participant),
    details: canRead && record ? {
      revision: record.revision, actualStart: record.actualStart, actualEnd: record.actualEnd,
      summary: record.summary, nextSteps: record.nextSteps,
      submittedBy: record.submittedBy, reviewerId: record.reviewerId, reviewer: record.reviewer,
      correction: signer ? record.correction : null,
    } : null,
  };
}

export async function getConsultationRecord(id: string, user: AuthenticatedUser) {
  const row = await prisma.consultation.findUnique({ where: { id }, include: consultationInclude });
  if (!row) throw consultationError(404, "Consultation not found.");
  const viewer = await access(prisma, row, user);
  const record = await prisma.consultationRecord.findUnique({ where: { consultationId: id } });
  return recordView(prisma, row, user, record, viewer);
}

const revision = z.number().int().min(0).max(2_147_483_646);
const recordAction = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"), revision,
    actualStart: z.string().datetime({ offset: true }),
    actualEnd: z.string().datetime({ offset: true }),
    summary: z.string().trim().min(1).max(1000),
    nextSteps: z.string().trim().max(1000),
    reviewerId: z.string().uuid(),
  }),
  z.object({ action: z.literal("confirm"), revision }),
  z.object({ action: z.literal("request_correction"), revision, correction: z.string().trim().min(1).max(500) }),
]);

export async function updateConsultationRecord(id: string, user: AuthenticatedUser, body: unknown) {
  const input = recordAction.safeParse(body);
  if (!input.success) throw consultationError(400, "Enter valid record details before continuing.");
  const action = input.data;
  return withConsultationLock(id, async (tx, row) => {
    const viewer = await access(tx, row, user);
    const record = await tx.consultationRecord.findUnique({ where: { consultationId: id } });
    const stale = action.revision !== (record?.revision ?? 0);
    const changed = "The record changed. Reopen it to review the latest version.";
    let saved: ConsultationRecord;
    if (action.action === "submit") {
      const { organizer, reviewers } = await recordSigners(tx, row, record?.reviewerId);
      if (user.researcherPanel || organizer?.id !== user.id || (record && record.submittedById !== user.id)) {
        throw consultationError(403, "Only the consultation organizer can submit the record.");
      }
      if (stale) throw consultationError(409, changed);
      if (!recordable(row) || (record && !record.correction)) {
        throw consultationError(409, "This consultation is not ready for a new record.");
      }
      const reviewer = reviewers.find(({ id }) => id === action.reviewerId);
      if (!reviewer) throw consultationError(400, "Choose an eligible invited participant to review the record.");
      const actualStart = new Date(action.actualStart);
      const actualEnd = new Date(action.actualEnd);
      const now = new Date();
      if (!Number.isFinite(+actualStart) || !Number.isFinite(+actualEnd) || actualEnd <= actualStart || actualEnd > now) {
        throw consultationError(400, "Enter actual times with an end after the start and no later than now.");
      }
      const data = {
        actualStart, actualEnd, summary: action.summary, nextSteps: action.nextSteps,
        submittedById: user.id, submittedBy: nameOf(organizer), submittedAt: now,
        reviewerId: reviewer.id, reviewer: nameOf(reviewer), reviewedAt: null, correction: null,
        revision: (record?.revision ?? 0) + 1,
      };
      if (row.status !== "COMPLETED") {
        await tx.consultation.update({
          where: { id }, data: { status: "COMPLETED", revision: { increment: 1 } },
        });
      }
      saved = record
        ? await tx.consultationRecord.update({ where: { consultationId: id }, data })
        : await tx.consultationRecord.create({ data: { ...data, consultationId: id } });
    } else {
      if (!record || !viewer.participant || record.reviewerId !== user.id) {
        throw consultationError(403, "Only the designated participant can review this record.");
      }
      if (stale) throw consultationError(409, changed);
      if (record.reviewedAt) {
        if (action.action === "confirm" && !record.correction) return recordView(tx, row, user, record, viewer);
        throw consultationError(409, "This version has already been reviewed.");
      }
      saved = await tx.consultationRecord.update({
        where: { consultationId: id },
        data: { reviewedAt: new Date(), correction: action.action === "request_correction" ? action.correction : null },
      });
    }
    if (action.action === "submit") {
      await notifyConsultation(tx, row, [saved.reviewerId], "Consultation record needs confirmation", saved.revision);
    } else if (action.action === "request_correction") {
      await notifyConsultation(tx, row, [saved.submittedById], "Consultation record needs a correction", saved.revision);
    }
    return recordView(tx, row, user, saved, viewer);
  });
}

export type ConsultationRecordView = Awaited<ReturnType<typeof getConsultationRecord>>;
