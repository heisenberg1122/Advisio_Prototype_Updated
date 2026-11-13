import { createHash, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Prisma, prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { monitoringDateSchema } from "../schemas/dean-monitoring.schema.js";
import { dateBounds, deanCollege } from "../services/dean-monitoring-scope.js";
import { googleMeetUrl, ConsultationCalendarError } from "../services/google-calendar.service.js";
import {
  consultationAudience, consultationInclude, consultationProjectAccess, coordinatorConsultationProjects,
  coordinatorConsultationRoles, joinableConsultationUrl,
  legacyConsultationImportKey, serializeConsultation,
} from "../services/consultation.service.js";
import {
  assertConsultationTimeAvailable, assertOrganizer, assertParticipant, consultationError, findConsultationRecipients,
  consultationReservations, googleEventKey, lockConsultationSchedules, notifyConsultation,
  pendingCalendarUpdate, provisionConsultation, recipientWorkspaces, syncConsultationCancellation, syncConsultationUpdate,
  uuid, withConsultationLock,
} from "../services/consultation-lifecycle.service.js";
import {
  consultationProof, consultationProofSelect, getConsultationRecord, updateConsultationRecord,
} from "../services/consultation-record.service.js";
import { renderConsultationRecordPdf } from "../services/consultation-record-pdf.js";

const router = Router();
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

function id(value: unknown) {
  if (typeof value !== "string" || !uuid.test(value)) throw consultationError(400, "Choose a valid consultation or research group.");
  return value.toLowerCase();
}

function dateRange(startValue: unknown, endValue: unknown, future = true) {
  const start = new Date(String(startValue || ""));
  const end = new Date(String(endValue || ""));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
      end <= start || (future && end.getTime() <= Date.now())) {
    throw consultationError(400, "Choose a valid start and end time. New consultations must end in the future.");
  }
  return { start, end };
}

function participantIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 40) throw consultationError(400, "Select up to 40 participants.");
  return [...new Set(value.map(id))].sort();
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const historyFilters = z.object({
  from: monitoringDateSchema,
  to: monitoringDateSchema,
  search: z.string().trim().max(160).optional(),
  status: z.enum(["COMPLETED", "CANCELLED", "UNRECORDED"]).optional(),
}).refine(({ from, to }) => !from || !to || from <= to, "End date must be on or after the start date.");

router.get("/workspace/coordinator/projects", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user!;
  if (!user.collegeId || !user.roles.some((role) => coordinatorConsultationRoles.includes(role))) {
    throw consultationError(403, "An authorized Coordinator college is required.");
  }
  const projects = await prisma.researchProject.findMany({
    where: { ...coordinatorConsultationProjects(user.id, user.collegeId), status: { not: "ARCHIVED" } },
    select: { id: true, title: true, groupName: true },
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });
  res.json({ projects });
}));

router.get("/workspace/:workspace", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user!;
  const workspace = req.params.workspace;
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw consultationError(400, "Choose a valid page.");
  const audience = consultationAudience(user);
  const isDean = workspace === "dean";
  if (isDean) {
    deanCollege(user);
  } else if (!user.collegeId ||
      !(workspace === "coordinator" && user.roles.some((role) => coordinatorConsultationRoles.includes(role))) &&
      !(workspace === "panelist" && user.roles.includes("PANELIST"))) {
    throw consultationError(403, "You cannot open this consultation workspace.");
  }
  const pageSize = 25;
  const requestedId = req.query.consultationId === undefined ? undefined : id(req.query.consultationId);
  const coordinatorHistory = workspace === "coordinator" && !user.researcherPanel && req.query.view === "history";
  const history = (isDean && req.query.view === "history") || coordinatorHistory;
  const scope: Prisma.ConsultationWhereInput = isDean ? { research: audience.research } : audience;
  const historyWhere: Prisma.ConsultationWhereInput = {};
  if (history) {
    const filters = historyFilters.safeParse(req.query);
    if (!filters.success) {
      throw consultationError(400, filters.error.issues[0]?.message || "Invalid history filters.");
    }
    const { from, to, search, status } = filters.data;
    if (search) {
      historyWhere.research = {
        ...audience.research,
        OR: [
          { groupName: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
        ],
      };
    }
    if (from || to) historyWhere.scheduledStart = dateBounds({ from, to });
    const unresolved: Prisma.ConsultationWhereInput = {
      scheduledEnd: { lte: new Date() },
      status: { in: ["REQUESTED", "PROVISIONING", "SCHEDULED", "ONGOING"] },
    };
    if (status === "UNRECORDED") Object.assign(historyWhere, unresolved);
    else if (status) historyWhere.status = status;
    else historyWhere.OR = [{ status: { in: ["COMPLETED", "CANCELLED"] } }, unresolved];
  }
  const where: Prisma.ConsultationWhereInput = coordinatorHistory && user.collegeId ? {
    AND: [
      { OR: [scope, { status: "COMPLETED", research: coordinatorConsultationProjects(user.id, user.collegeId) }] },
      historyWhere,
    ],
  } : { ...scope, ...historyWhere };
  const rows = await prisma.consultation.findMany({
    where: { ...where, ...(requestedId ? { id: requestedId } : {}) },
    select: {
      id: true, title: true, status: true, scheduledStart: true, scheduledEnd: true,
      meetingKind: true, meetingUrl: !history, conferenceState: true, revision: true, researchId: true,
      approverId: true, createdBy: true, pendingCalendarUpdate: true,
      record: { select: consultationProofSelect },
      participants: {
        where: workspace === "coordinator" ? undefined : { userId: user.id },
        select: { userId: true, attendanceStatus: true, user: { select: { firstName: true, lastName: true } } },
      },
      research: { select: {
        title: true,
        groupName: true,
        members: history ? {
          where: consultationInclude.research.select.members.where,
          select: { user: consultationInclude.research.select.members.select.user },
        } : false,
      } },
    },
    orderBy: [{ scheduledStart: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });
  res.json({
    consultations: rows.slice(0, pageSize).map(({ participants, ...row }) => {
      const { id, title, status, scheduledStart, scheduledEnd, research } = row;
      const summary = {
        id, title, status, scheduledStart, scheduledEnd, research,
        ...(row.record ? { proof: consultationProof(id, row.record, user.id) } : {}),
      };
      if (history) return summary;
      const invitation = participants.find(({ userId }) => userId === user.id);
      const canManage = Boolean(invitation) && workspace === "coordinator" && (row.approverId || row.createdBy) === user.id;
      return {
        ...summary,
        ...(invitation ? {
          meetingKind: row.meetingKind, conferenceState: row.conferenceState,
          meetingUrl: joinableConsultationUrl(row), attendanceStatus: invitation.attendanceStatus,
        } : {}),
        ...(canManage ? {
          canManage, researchId: row.researchId, createdBy: row.createdBy, participants, revision: row.revision,
          calendarUpdatePending: Boolean(row.pendingCalendarUpdate),
        } : {}),
      };
    }),
    hasNextPage: rows.length > pageSize,
  });
}));

router.get("/:id/record", requireAuth, asyncHandler(async (req, res) => {
  res.json(await getConsultationRecord(id(req.params.id), req.user!));
}));

router.patch("/:id/record", requireAuth, asyncHandler(async (req, res) => {
  res.json(await updateConsultationRecord(id(req.params.id), req.user!, req.body));
}));

router.get("/:id/record/pdf", requireAuth, asyncHandler(async (req, res) => {
  const format = req.query.format ?? "proof";
  if (format !== "proof" && format !== "full") throw consultationError(400, "Choose a valid PDF format.");
  const record = await getConsultationRecord(id(req.params.id), req.user!);
  if (format === "full" && !record.details) throw consultationError(404, "Full consultation record not found.");
  if (record.proof?.status !== "confirmed") throw consultationError(409, "Both participants must confirm the record before export.");
  const pdf = await renderConsultationRecordPdf(record, record.proof, format === "full" ? record.details! : undefined);
  res.attachment(`${record.proof.reference}-${format}.pdf`).type("application/pdf").send(pdf);
}));

router.get("/recipients", requireAuth, asyncHandler(async (req, res) => {
  const researchId = id(req.query.researchId);
  const { project, access } = await consultationProjectAccess(req.user!, researchId);
  const adviserOnly = req.query.adviser === "true";
  if (!project || project.status === "ARCHIVED" || !access.canRequest || (!access.canApprove && !adviserOnly && req.query.instant !== "true")) {
    throw consultationError(403, "You cannot invite participants for this project.");
  }
  const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const users = await findConsultationRecipients(project, !adviserOnly && access.canApprove, {
    id: { not: req.user!.id },
    ...(adviserOnly ? {
      memberships: { some: { researchId, projectRole: "ADVISER", leftAt: null } },
      collegeMemberships: { some: { collegeId: project.collegeId, roleNames: { has: "ADVISER" } } },
    } : {}),
    ...(search ? { AND: search.split(/\s+/).map((word) => ({ OR: [
      { firstName: { contains: word, mode: "insensitive" } },
      { lastName: { contains: word, mode: "insensitive" } },
      { email: { contains: word, mode: "insensitive" } },
    ] })) } : {}),
  }, 30);
  res.json({ recipients: users.map((user) => ({
    id: user.id, name: `${user.firstName} ${user.lastName}`.trim(),
    roles: recipientWorkspaces(user, project.collegeId).map(({ label }) => label),
  })) });
}));

router.get("/availability", requireAuth, asyncHandler(async (req, res) => {
  const researchId = id(req.query.researchId);
  const adviserId = id(req.query.adviserId);
  const date = monitoringDateSchema.safeParse(req.query.date);
  const duration = Number(req.query.duration);
  if (!date.success || !date.data || ![30, 45, 60].includes(duration)) {
    throw consultationError(400, "Choose a date and consultation duration.");
  }
  const { project, access } = await consultationProjectAccess(req.user!, researchId);
  if (!project || project.status === "ARCHIVED" || !access.canRequest) {
    throw consultationError(403, "You cannot check consultation times for this project.");
  }
  const assigned = await findConsultationRecipients(project, false, {
    id: adviserId,
    memberships: { some: { researchId, projectRole: "ADVISER", leftAt: null } },
    collegeMemberships: { some: { collegeId: project.collegeId, roleNames: { has: "ADVISER" }, college: { isActive: true } } },
  }, 1);
  if (!assigned.length) throw consultationError(404, "This adviser is not assigned to your project.");

  const start = new Date(`${date.data}T08:00:00+08:00`);
  const end = new Date(`${date.data}T17:00:00+08:00`);
  const reservations = await consultationReservations(prisma, [adviserId], { start, end });
  const slots = [];
  const durationMs = duration * 60_000;
  const now = Date.now();
  for (let time = +start; time + durationMs <= +end; time += 30 * 60_000) {
    if (time > now && !reservations.some((slot) => +slot.start < time + durationMs && +slot.end > time)) {
      slots.push(new Date(time).toISOString());
    }
  }
  res.json({ slots });
}));

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user!;
  const researchId = req.query.researchId === undefined ? undefined : id(req.query.researchId);
  const audience = consultationAudience(user);
  const rows = await prisma.consultation.findMany({
    where: {
      researchId,
      AND: [{ OR: [
        audience,
        ...(!user.researcherPanel && user.roles.includes("ADVISER") ? [{
          conferenceState: "LEGACY" as const, status: "REQUESTED" as const,
          research: { ...audience.research, members: { some: { userId: user.id, projectRole: "ADVISER" as const, leftAt: null } } },
        }, {
          conferenceState: "LEGACY" as const, status: "COMPLETED" as const, approverId: null,
          research: { ...audience.research, members: {
            some: { userId: user.id, projectRole: "ADVISER" as const, leftAt: null },
            none: { userId: { not: user.id }, projectRole: "ADVISER" as const, leftAt: null },
          } },
        }] : []),
      ] }],
    },
    include: { ...consultationInclude, record: { select: consultationProofSelect } },
    orderBy: [{ scheduledStart: "desc" }, { id: "desc" }],
  });
  res.json({ consultations: rows.map((row) => {
    const invited = row.participants.some(({ userId }) => userId === user.id);
    const legacyRequest = row.status === "REQUESTED" && row.conferenceState === "LEGACY" &&
      row.research.members.some(({ userId }) => userId === user.id);
    return {
      ...serializeConsultation(invited ? row : { ...row, notes: [], participants: [], meetingUrl: null }),
      ...(row.record ? { proof: consultationProof(row.id, row.record, user.id) } : {}),
      canManage: (row.meetingKind === "INSTANT" && row.createdBy === user.id) ||
        (!user.researcherPanel && ((row.approverId || row.createdBy) === user.id || legacyRequest)),
    };
  }) });
}));

function provisioningResponse(res: Response, result: Awaited<ReturnType<typeof provisionConsultation>>, status = 200) {
  res.status(result.failed ? 502 : result.warning ? 202 : status).json({
    success: !result.warning,
    consultation: serializeConsultation(result.row),
    ...(result.warning ? { warning: result.warning, error: result.warning } : {}),
  });
}

router.post("/", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user!;
  const researchId = id(req.body?.researchId);
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() || null : null;
  if (!title || title.length > 200 || (description?.length || 0) > 5000) {
    throw consultationError(400, "Enter a topic up to 200 characters and a description up to 5,000 characters.");
  }
  const instant = req.body.instant === true;
  const now = new Date();
  const range = instant ? { start: now, end: new Date(now.getTime() + 60 * 60_000) }
    : dateRange(req.body.scheduledStart, req.body.scheduledEnd, false);
  const { project, access } = await consultationProjectAccess(user, researchId);
  if (!project || project.status === "ARCHIVED" || !access.canRequest) {
    throw consultationError(403, "You cannot create consultations for this project.");
  }
  const request = !instant && !access.canApprove;
  if (request && !project.members.some(({ projectRole }) => projectRole === "LEADER" || projectRole === "MEMBER")) {
    throw consultationError(403, "Only current researchers can request a meeting with the assigned adviser.");
  }
  const selected = participantIds(req.body.participantIds).filter((userId) => userId !== user.id);
  const manualUrl = req.body.meetingUrl ? googleMeetUrl(req.body.meetingUrl) : null;
  if (req.body.meetingUrl && (!manualUrl || request || instant)) {
    throw consultationError(400, "Only faculty scheduling in advance may provide an existing Google Meet room link.");
  }
  const adviserId = request ? id(req.body.adviserId) : null;
  if (request && selected.length) throw consultationError(400, "A student request goes to the selected assigned adviser.");
  if (!request && !selected.length) throw consultationError(400, "Select at least one participant.");
  const requestHash = digest(JSON.stringify([researchId, title, description, instant,
    instant ? null : range, selected, adviserId, manualUrl]));
  const clientKey = req.body.requestKey === undefined ? requestHash : id(req.body.requestKey);
  const requestKey = digest(`${user.id}:${clientKey}`);
  const existing = () => prisma.consultation.findUnique({ where: { requestKey }, include: consultationInclude });
  let row = await existing();
  if (!row) {
    if (range.end <= now) throw consultationError(400, "Choose a consultation end time in the future.");
    if (adviserId) {
      const advisers = await findConsultationRecipients(project, false, {
        id: adviserId,
        collegeMemberships: { some: { collegeId: project.collegeId, roleNames: { has: "ADVISER" } } },
        memberships: { some: { researchId, projectRole: "ADVISER", leftAt: null } },
      });
      if (!advisers.length) throw consultationError(400, "Choose an active adviser assigned to this research group.");
    } else {
      const allowed = await findConsultationRecipients(project, access.canApprove, { id: { in: selected } });
      if (allowed.length !== selected.length) throw consultationError(403, "One or more selected participants cannot be invited to this project.");
    }
    const consultationId = randomUUID();
    try {
      row = await prisma.$transaction(async (tx) => {
        if (!request && !instant) {
          const userIds = await lockConsultationSchedules(tx, user.id, selected);
          const retry = await tx.consultation.findUnique({ where: { requestKey }, include: consultationInclude });
          if (retry) return retry;
          await assertConsultationTimeAvailable(tx, userIds, range);
        }
        const created = await tx.consultation.create({
          data: {
            id: consultationId, researchId, createdBy: user.id, title, description,
            scheduledStart: range.start, scheduledEnd: range.end,
            meetingKind: instant ? "INSTANT" : "SCHEDULED", meetingUrl: manualUrl,
            conferenceState: request ? "AWAITING_APPROVAL" : "PENDING",
            status: request ? "REQUESTED" : "PROVISIONING", approverId: adviserId,
            googleEventId: request ? null : googleEventKey(consultationId), requestKey, requestHash,
            participants: { create: [user.id, ...(adviserId ? [adviserId] : selected)].map((userId) => ({ userId })) },
          },
          include: consultationInclude,
        });
        if (adviserId) await notifyConsultation(tx, created, [adviserId], "New consultation request");
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      row = await existing();
      if (!row) throw error;
    }
  }
  if (row.requestHash !== requestHash) throw consultationError(409, "This submission key belongs to another consultation. Reopen the form to submit changed details.");
  assertParticipant(row, user);
  if (["CANCELLED", "COMPLETED", "DECLINED"].includes(row.status)) {
    throw consultationError(409, `This consultation is already ${row.status.toLowerCase()}.`);
  }
  if (row.status !== "PROVISIONING" || request) {
    res.status(201).json({ success: true, consultation: serializeConsultation(row) });
    return;
  }
  provisioningResponse(res, await provisionConsultation(row.id, user), 201);
}));

// Preserve browser records created before consultations were stored in PostgreSQL.
router.post("/import", requireAuth, asyncHandler(async (req, res) => {
  const researchId = id(req.body?.researchId);
  const { access } = await consultationProjectAccess(req.user!, researchId);
  if (!access.canRequest) throw consultationError(403, "You cannot import consultations for this project.");
  const items = Array.isArray(req.body.consultations) ? req.body.consultations.slice(0, 50) : [];
  const receipts = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const clientId = String(item.id || item.clientId || "").trim();
    const title = String(item.topic || item.title || "").trim().slice(0, 200);
    const start = new Date(item.scheduledStart || `${item.date || ""}T${item.time || "09:00"}:00+08:00`);
    const end = new Date(item.scheduledEnd || new Date(start.getTime() + 60 * 60_000));
    if (!clientId || !title || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) continue;
    const legacyImportKey = legacyConsultationImportKey({ userId: req.user!.id, researchId, clientId });
    try {
      const created = await prisma.consultation.create({
        data: {
          researchId, createdBy: req.user!.id, legacyImportKey, title,
          description: String(item.description || "").trim().slice(0, 5000) || null,
          scheduledStart: start, scheduledEnd: end, status: "REQUESTED",
          meetingUrl: googleMeetUrl(item.meetingUrl), participants: { create: { userId: req.user!.id } },
        },
        select: { id: true },
      });
      receipts.push({ clientId, consultationId: created.id, imported: true });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const existing = await prisma.consultation.findUniqueOrThrow({ where: { legacyImportKey }, select: { id: true } });
      receipts.push({ clientId, consultationId: existing.id, imported: false });
    }
  }
  res.json({ success: true, receipts });
}));

router.patch("/:id/approve", requireAuth, asyncHandler(async (req, res) => {
  const range = req.body?.scheduledStart || req.body?.scheduledEnd
    ? dateRange(req.body.scheduledStart, req.body.scheduledEnd) : undefined;
  provisioningResponse(res, await provisionConsultation(id(req.params.id), req.user!, range));
}));

router.patch("/:id", requireAuth, asyncHandler(async (req, res) => {
  const consultationId = id(req.params.id);
  const user = req.user!;
  const action = req.body?.action;
  if (!["decline", "cancel", "complete", "reschedule"].includes(action)) throw consultationError(400, "Choose a consultation action.");
  let updated = await withConsultationLock(consultationId, async (tx, row) => {
    if (action === "cancel" && ["REQUESTED", "CANCELLED"].includes(row.status) && row.createdBy === user.id) assertParticipant(row, user);
    else await assertOrganizer(tx, row, user, true);
    const previousIds = row.participants.map(({ userId }) => userId);
    if (action === "reschedule") {
      if (row.status !== "SCHEDULED" || row.meetingKind === "INSTANT" || row.research.status === "ARCHIVED") {
        throw consultationError(409, "Only scheduled consultations in active projects can be edited.");
      }
      const range = dateRange(req.body.scheduledStart, req.body.scheduledEnd);
      let nextIds = previousIds;
      if (req.body.participantIds !== undefined) {
        const selected = participantIds(req.body.participantIds).filter((userId) => userId !== user.id);
        const { project, access } = await consultationProjectAccess(user, row.researchId, tx);
        if (!project || !access.canApprove) throw consultationError(403, "You cannot change these participants.");
        const required = [row.createdBy, user.id];
        const optional = selected.filter((userId) => !required.includes(userId));
        const allowed = await findConsultationRecipients(project, true, { id: { in: optional } }, undefined, tx);
        if (allowed.length !== optional.length) throw consultationError(403, "One or more selected participants cannot be invited to this project.");
        nextIds = [...new Set([...required, ...optional])];
        if (nextIds.length < 2) throw consultationError(400, "Select at least one participant.");
      }
      const operation = { start: range.start.toISOString(), end: range.end.toISOString(), participantIds: [...nextIds].sort() };
      if (row.pendingCalendarUpdate) {
        const pending = pendingCalendarUpdate.parse(row.pendingCalendarUpdate);
        if (JSON.stringify(pending) !== JSON.stringify(operation)) {
          throw consultationError(409, "An earlier edit is still syncing to Google Calendar. Wait for it to finish before submitting another edit.");
        }
        return row;
      }
      const moved = +range.start !== +row.scheduledStart || +range.end !== +row.scheduledEnd;
      if (!moved && previousIds.length === nextIds.length && previousIds.every((userId) => nextIds.includes(userId))) return row;
      if (req.body.revision !== undefined && req.body.revision !== row.revision) {
        throw consultationError(409, "This consultation changed while you were editing. Reopen it to review the latest details.");
      }
      const activeCount = await tx.user.count({
        where: { id: { in: nextIds }, status: "ACTIVE" },
      });
      if (activeCount !== nextIds.length) throw consultationError(409, "Remove inactive participants before updating this consultation.");
      const userIds = await lockConsultationSchedules(tx, row.approverId ?? row.createdBy, nextIds);
      await assertConsultationTimeAvailable(tx, userIds, range, row.id);
      return tx.consultation.update({
        where: { id: row.id },
        data: { pendingCalendarUpdate: operation, googleEventId: row.googleEventId || googleEventKey(row.id) },
        include: consultationInclude,
      });
    }
    const target = action === "decline" ? "DECLINED" : action === "complete" ? "COMPLETED" : "CANCELLED";
    if (row.status === target) return row;
    const valid = action === "decline" ? row.status === "REQUESTED"
      : action === "complete" ? row.status === "ONGOING" || (row.status === "SCHEDULED" && row.scheduledStart <= new Date())
      : ["REQUESTED", "PROVISIONING", "SCHEDULED", "ONGOING"].includes(row.status);
    if (!valid || (row.pendingCalendarUpdate && action === "complete")) {
      throw consultationError(409, "That action is unavailable for the current consultation status.");
    }
    const changed = await tx.consultation.update({
      where: { id: row.id },
      data: {
        status: target,
        revision: { increment: 1 },
        ...(action === "cancel" ? {
          pendingCalendarUpdate: Prisma.DbNull, calendarCancellationPending: Boolean(row.googleEventId),
        } : {}),
      },
      include: consultationInclude,
    });
    await notifyConsultation(tx, changed, previousIds, action === "complete" ? "Advisio consultation completed"
      : action === "decline" ? "Consultation request declined" : "Consultation cancelled");
    return changed;
  });
  let warning: string | undefined;
  if (action === "reschedule" && updated.pendingCalendarUpdate) {
    try {
      updated = await syncConsultationUpdate(updated.id);
      if (updated.status === "CANCELLED") throw consultationError(409, "This consultation was cancelled while the edit was pending.");
    } catch (error) {
      if (!(error instanceof ConsultationCalendarError)) throw error;
      warning = `${error.message} The edit is queued for retry.`;
    }
  }
  if (action === "cancel" && updated.calendarCancellationPending) {
    try {
      await syncConsultationCancellation(updated.id);
    } catch {
      warning = "Cancelled in Advisio. Google Calendar cancellation is awaiting retry.";
    }
  }
  res.status(warning ? 202 : 200).json({
    success: action === "cancel" || !warning,
    consultation: serializeConsultation(updated),
    ...(warning ? { warning } : {}),
  });
}));

router.get("/:id/notes", requireAuth, asyncHandler(async (req, res) => {
  const row = await prisma.consultation.findUnique({ where: { id: id(req.params.id) }, include: consultationInclude });
  if (!row) throw consultationError(404, "Consultation not found.");
  assertParticipant(row, req.user!);
  const note = row.notes[0];
  res.json({ success: true, notes: note?.notes || "", actionItems: note?.actionItems || [], transcript: note?.transcript || [] });
}));

router.post("/:id/notes", requireAuth, asyncHandler(async (req, res) => {
  const note = await withConsultationLock(id(req.params.id), async (tx, row) => {
    assertParticipant(row, req.user!);
    return tx.consultationNote.create({
      data: {
        consultationId: row.id, authorId: req.user!.id, notes: String(req.body.notes || "").trim(),
        actionItems: Array.isArray(req.body.actionItems) ? req.body.actionItems : [],
        transcript: Array.isArray(req.body.transcript) ? req.body.transcript : [],
      },
    });
  });
  res.status(201).json({ success: true, consultationId: note.consultationId, notes: note.notes, actionItems: note.actionItems, transcript: note.transcript });
}));

router.post("/:id/join", requireAuth, asyncHandler(async (req, res) => {
  const meetingUrl = await withConsultationLock(id(req.params.id), async (tx, row) => {
    assertParticipant(row, req.user!);
    const url = joinableConsultationUrl(row);
    if (!url) throw consultationError(409, "This consultation has no available meeting link.");
    await tx.consultationParticipant.update({
      where: { consultationId_userId: { consultationId: row.id, userId: req.user!.id } },
      data: { attendanceStatus: "JOINED", joinedAt: new Date(), leftAt: null },
    });
    if (row.status === "SCHEDULED" && !row.pendingCalendarUpdate && row.scheduledStart.getTime() <= Date.now() && row.scheduledEnd.getTime() > Date.now()) {
      await tx.consultation.update({ where: { id: row.id }, data: { status: "ONGOING", revision: { increment: 1 } } });
    }
    return url;
  });
  res.json({ success: true, meetingUrl });
}));

router.post("/:id/leave", requireAuth, asyncHandler(async (req, res) => {
  await withConsultationLock(id(req.params.id), async (tx, row) => {
    assertParticipant(row, req.user!);
    await tx.consultationParticipant.updateMany({
      where: { consultationId: row.id, userId: req.user!.id, attendanceStatus: "JOINED" },
      data: { attendanceStatus: "LEFT", leftAt: new Date() },
    });
  });
  res.json({ success: true });
}));

export default router;
