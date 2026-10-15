import { Router, type Request, type Response } from "express";
import { AttendanceStatus, ConsultationStatus, Prisma, prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { googleCalendarService } from "../services/google-calendar.service.js";
import {
  consultationInclude,
  consultationProjectAccess,
  legacyConsultationImportKey,
  serializeConsultation,
} from "../services/consultation.service.js";

const router = Router();

function validDateRange(startValue: unknown, endValue: unknown) {
  const start = new Date(String(startValue || ""));
  const end = new Date(String(endValue || ""));
  return {
    start,
    end,
    valid:
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end.getTime() > start.getTime(),
  };
}

async function accessibleConsultation(id: string, user: NonNullable<Request["user"]>) {
  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: consultationInclude,
  });
  if (!consultation) return { consultation: null, access: null };
  const { access } = await consultationProjectAccess(user, consultation.researchId);
  return { consultation, access };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const researchId = req.query.researchId ? String(req.query.researchId) : null;
    if (researchId) {
      const { project, access } = await consultationProjectAccess(req.user!, researchId);
      if (!project) return void res.status(404).json({ error: "Research project not found." });
      if (!access.canView) return void res.status(403).json({ error: "You cannot view consultations for this project." });
    }

    const memberships = researchId
      ? [researchId]
      : (
          await prisma.researchProject.findMany({
            where: req.user!.roles.includes("SYSTEM_ADMIN")
              ? {}
              : {
                  OR: [
                    { members: { some: { userId: req.user!.id, leftAt: null } } },
                    { workflowInstance: { is: { workflow: { createdBy: req.user!.id } } } },
                  ],
                },
            select: { id: true },
          })
        ).map((project) => project.id);

    const consultations = await prisma.consultation.findMany({
      where: { researchId: { in: memberships } },
      include: consultationInclude,
      orderBy: { scheduledStart: "desc" },
    });
    res.json({ consultations: consultations.map(serializeConsultation) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load consultations." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const researchId = String(req.body.researchId || "");
    const title = String(req.body.title || "").trim().slice(0, 200);
    const range = validDateRange(req.body.scheduledStart, req.body.scheduledEnd);
    if (!researchId || !title || !range.valid) {
      return void res.status(400).json({ error: "A valid project, title, start, and end time are required." });
    }
    const { project, access } = await consultationProjectAccess(req.user!, researchId);
    if (!project) return void res.status(404).json({ error: "Research project not found." });
    if (!access.canRequest) return void res.status(403).json({ error: "You cannot request consultations for this project." });

    const requestedParticipantIds = Array.isArray(req.body.participantIds)
      ? req.body.participantIds.map(String)
      : [];
    const allowedParticipants = requestedParticipantIds.length
      ? await prisma.researchMember.findMany({
          where: { researchId, userId: { in: requestedParticipantIds }, leftAt: null },
          select: { userId: true },
        })
      : [];
    const participantIds = new Set([
      req.user!.id,
      ...allowedParticipants.map((member) => member.userId),
    ]);
    const providedMeetingUrl = String(req.body.meetingUrl || "").trim() || null;
    const created = await prisma.consultation.create({
      data: {
        researchId,
        createdBy: req.user!.id,
        title,
        description: String(req.body.description || "").trim() || null,
        scheduledStart: range.start,
        scheduledEnd: range.end,
        meetingUrl: providedMeetingUrl,
        status: access.canApprove ? ConsultationStatus.SCHEDULED : ConsultationStatus.REQUESTED,
        participants: {
          create: Array.from(participantIds).map((userId) => ({ userId })),
        },
      },
      include: consultationInclude,
    });

    let consultation = created;
    let calendarWarning: string | undefined;
    if (!providedMeetingUrl) {
      try {
        const meet = await googleCalendarService.createMeetConsultation({
          title: `Advisio Consultation: ${title}`,
          description: created.description || "Research advising consultation",
          scheduledStart: range.start.toISOString(),
          scheduledEnd: range.end.toISOString(),
          attendees: [{ email: req.user!.email, displayName: `${req.user!.firstName || ""} ${req.user!.lastName || ""}`.trim() }],
        });
        consultation = await prisma.consultation.update({
          where: { id: created.id },
          data: { meetingUrl: meet.meetingUrl || null },
          include: consultationInclude,
        });
      } catch {
        calendarWarning = "The consultation was saved, but a Google Meet link could not be created yet.";
      }
    }

    res.status(201).json({
      success: true,
      consultation: serializeConsultation(consultation),
      meetingUrl: consultation.meetingUrl || "",
      ...(calendarWarning ? { warning: calendarWarning } : {}),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to schedule consultation." });
  }
});

// One-time, idempotent import for legacy browser-only consultation links.
router.post("/import", requireAuth, async (req, res) => {
  try {
    const researchId = String(req.body.researchId || "");
    const items = Array.isArray(req.body.consultations) ? req.body.consultations.slice(0, 50) : [];
    const { project, access } = await consultationProjectAccess(req.user!, researchId);
    if (!project) return void res.status(404).json({ error: "Research project not found." });
    if (!access.canRequest) return void res.status(403).json({ error: "You cannot import consultations for this project." });

    const receipts: Array<{ clientId: string; consultationId: string; imported: boolean }> = [];
    for (const item of items) {
      const clientId = String(item.id || item.clientId || "").trim();
      const title = String(item.topic || item.title || "").trim().slice(0, 200);
      const start = new Date(item.scheduledStart || `${item.date || ""}T${item.time || "09:00"}`);
      const end = new Date(item.scheduledEnd || new Date(start.getTime() + 60 * 60 * 1000));
      if (!clientId || !title || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      const legacyImportKey = legacyConsultationImportKey({ userId: req.user!.id, researchId, clientId });
      const existing = await prisma.consultation.findUnique({ where: { legacyImportKey }, select: { id: true } });
      if (existing) {
        receipts.push({ clientId, consultationId: existing.id, imported: false });
        continue;
      }
      try {
        const created = await prisma.consultation.create({
          data: {
            researchId,
            createdBy: req.user!.id,
            legacyImportKey,
            title,
            description: String(item.description || "").trim() || null,
            scheduledStart: start,
            scheduledEnd: end,
            meetingUrl: String(item.meetingUrl || "").trim() || null,
            status: ConsultationStatus.REQUESTED,
            participants: { create: { userId: req.user!.id } },
          },
        });
        receipts.push({ clientId, consultationId: created.id, imported: true });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const raced = await prisma.consultation.findUniqueOrThrow({
            where: { legacyImportKey },
            select: { id: true },
          });
          receipts.push({ clientId, consultationId: raced.id, imported: false });
          continue;
        }
        throw error;
      }
    }
    res.json({ success: true, receipts });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to import consultations." });
  }
});

router.patch("/:id/approve", requireAuth, async (req, res) => {
  try {
    const context = await accessibleConsultation(String(req.params.id), req.user!);
    if (!context.consultation) return void res.status(404).json({ error: "Consultation not found." });
    if (!context.access?.canApprove) return void res.status(403).json({ error: "Only assigned faculty can approve this consultation." });
    const consultation = await prisma.consultation.update({
      where: { id: context.consultation.id },
      data: { status: ConsultationStatus.SCHEDULED },
      include: consultationInclude,
    });
    res.json({ success: true, consultation: serializeConsultation(consultation) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to approve consultation." });
  }
});

router.post("/:id/notes", requireAuth, async (req, res) => {
  try {
    const context = await accessibleConsultation(String(req.params.id), req.user!);
    if (!context.consultation) return void res.status(404).json({ error: "Consultation not found." });
    if (!context.access?.canView) return void res.status(403).json({ error: "You cannot update this consultation." });
    const notes = String(req.body.notes || "").trim();
    const actionItems = Array.isArray(req.body.actionItems) ? req.body.actionItems : [];
    const transcript = Array.isArray(req.body.transcript) ? req.body.transcript : [];
    const saved = await prisma.consultationNote.create({
      data: { consultationId: context.consultation.id, authorId: req.user!.id, notes, actionItems, transcript },
    });
    res.status(201).json({ success: true, consultationId: context.consultation.id, notes: saved.notes, actionItems: saved.actionItems || [], transcript: saved.transcript || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save consultation notes." });
  }
});

router.get("/:id/notes", requireAuth, async (req, res) => {
  try {
    const context = await accessibleConsultation(String(req.params.id), req.user!);
    if (!context.consultation) return void res.status(404).json({ error: "Consultation not found." });
    if (!context.access?.canView) return void res.status(403).json({ error: "You cannot view this consultation." });
    const note = await prisma.consultationNote.findFirst({ where: { consultationId: context.consultation.id }, orderBy: { createdAt: "desc" } });
    res.json({ success: true, notes: note?.notes || "", actionItems: note?.actionItems || [], transcript: note?.transcript || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get consultation notes." });
  }
});

router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    const context = await accessibleConsultation(String(req.params.id), req.user!);
    if (!context.consultation) return void res.status(404).json({ error: "Consultation not found." });
    if (!context.access?.canView) return void res.status(403).json({ error: "You cannot join this consultation." });
    await prisma.consultationParticipant.upsert({
      where: { consultationId_userId: { consultationId: context.consultation.id, userId: req.user!.id } },
      create: { consultationId: context.consultation.id, userId: req.user!.id, attendanceStatus: AttendanceStatus.JOINED, joinedAt: new Date() },
      update: { attendanceStatus: AttendanceStatus.JOINED, joinedAt: new Date(), leftAt: null },
    });
    const participants = await prisma.consultationParticipant.findMany({
      where: { consultationId: context.consultation.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    res.json({ success: true, participants });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to record consultation join." });
  }
});

router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const context = await accessibleConsultation(String(req.params.id), req.user!);
    if (!context.consultation) return void res.status(404).json({ error: "Consultation not found." });
    if (!context.access?.canView) return void res.status(403).json({ error: "You cannot access this consultation." });
    await prisma.consultationParticipant.updateMany({
      where: { consultationId: context.consultation.id, userId: req.user!.id },
      data: { attendanceStatus: AttendanceStatus.LEFT, leftAt: new Date() },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to record consultation leave." });
  }
});

type ActiveStream = {
  groupId: string;
  groupName: string;
  topic: string;
  meetingUrl: string;
  isActive: boolean;
  startedBy: string;
  startedAt: string;
  participants: Array<{ id: string; name: string; role: string; email: string; joinedAt: string }>;
};
const activeStreams: Record<string, ActiveStream> = {};

router.get("/active-stream", requireAuth, async (req, res) => {
  try {
    const groupId = String(req.query.groupId || "");
    const { project, access } = await consultationProjectAccess(req.user!, groupId);
    if (!project) return void res.status(404).json({ error: "Research project not found." });
    if (!access.canView) return void res.status(403).json({ error: "You cannot access this conference." });
    res.json({ success: true, stream: activeStreams[groupId] || { groupId, groupName: project.title, topic: "Group Conferencing", meetingUrl: "", isActive: false, startedBy: "", startedAt: "", participants: [] } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load active conference." });
  }
});

router.post("/active-stream", requireAuth, async (req, res) => {
  try {
    const groupId = String(req.body.groupId || "");
    const meetingUrl = String(req.body.meetingUrl || "").trim();
    const { project, access } = await consultationProjectAccess(req.user!, groupId);
    if (!project) return void res.status(404).json({ error: "Research project not found." });
    if (!access.canView) return void res.status(403).json({ error: "You cannot access this conference." });
    if (!meetingUrl) return void res.status(400).json({ error: "A meeting URL is required." });
    const displayName = `${req.user!.firstName || ""} ${req.user!.lastName || ""}`.trim() || req.user!.email;
    const previous = activeStreams[groupId];
    const participant = { id: req.user!.id, name: displayName, role: access.isAssignedFaculty ? "Faculty Adviser" : "Student Researcher", email: req.user!.email, joinedAt: new Date().toISOString() };
    activeStreams[groupId] = {
      groupId,
      groupName: String(req.body.groupName || project.title),
      topic: String(req.body.topic || "Group Conferencing"),
      meetingUrl,
      isActive: true,
      startedBy: previous?.startedBy || displayName,
      startedAt: previous?.startedAt || new Date().toISOString(),
      participants: [...(previous?.participants || []).filter((item) => item.id !== req.user!.id), participant],
    };
    res.json({ success: true, stream: activeStreams[groupId] });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update active conference." });
  }
});

router.post("/active-stream/end", requireAuth, async (req, res) => {
  try {
    const groupId = String(req.body.groupId || "");
    const { project, access } = await consultationProjectAccess(req.user!, groupId);
    if (!project) return void res.status(404).json({ error: "Research project not found." });
    if (!access.canView) return void res.status(403).json({ error: "You cannot access this conference." });
    if (activeStreams[groupId]) activeStreams[groupId] = { ...activeStreams[groupId], isActive: false, participants: [] };
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to end active conference." });
  }
});

export default router;
