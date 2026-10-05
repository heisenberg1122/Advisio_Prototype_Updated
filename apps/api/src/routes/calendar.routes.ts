import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const MANAGER_ROLES = new Set(["RESEARCH_COORDINATOR", "RPO", "REB", "VPAA", "SYSTEM_ADMIN"]);

function parseRange(req: Request) {
  const now = new Date();
  const fallbackStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fallbackEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
  const start = req.query.start ? new Date(String(req.query.start)) : fallbackStart;
  const end = req.query.end ? new Date(String(req.query.end)) : fallbackEnd;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return null;
  if (end.getTime() - start.getTime() > 370 * 24 * 60 * 60 * 1000) return null;
  return { start, end };
}

function isPanelistOnly(req: Request) {
  return req.user!.roles.includes("PANELIST") &&
    !req.user!.roles.some((role) => MANAGER_ROLES.has(role) || role === "ADVISER" || role === "RESEARCH_COORDINATOR");
}

router.get("/calendar/options", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const allowed = user.roles.some((role) => MANAGER_ROLES.has(role) || role === "ADVISER");
    if (!allowed) return void res.json({ canCreate: false, groups: [], people: [] });
    const manager = user.roles.some((role) => MANAGER_ROLES.has(role));
    const [groups, people] = await Promise.all([
      prisma.researchProject.findMany({
        where: {
          ...(user.collegeId && { collegeId: user.collegeId }),
          ...(!manager && { members: { some: { userId: user.id, projectRole: "ADVISER", leftAt: null } } }),
          status: { not: "ARCHIVED" },
        },
        select: { id: true, groupName: true, title: true, program: { select: { code: true } } },
        orderBy: { updatedAt: "desc" }, take: 100,
      }),
      prisma.user.findMany({
        where: { status: "ACTIVE", ...(user.collegeId && { collegeId: user.collegeId }) },
        select: { id: true, firstName: true, lastName: true, program: { select: { code: true } }, roles: { select: { role: { select: { name: true } } } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 200,
      }),
    ]);
    res.json({
      canCreate: true,
      groups: groups.map((group) => ({ id: group.id, name: group.groupName || group.title, programCode: group.program.code })),
      people: people.map((person) => ({ id: person.id, name: `${person.firstName} ${person.lastName}`, programCode: person.program?.code, roles: person.roles.map((item) => item.role.name) })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load calendar scheduling options." });
  }
});

router.get("/calendar", requireAuth, async (req: Request, res: Response) => {
  try {
    const range = parseRange(req);
    if (!range) return void res.status(400).json({ error: "Choose a valid calendar range of up to one year." });
    const user = req.user!;
    const manager = user.roles.some((role) => MANAGER_ROLES.has(role));
    const panelistOnly = isPanelistOnly(req);
    const systemAdmin = user.roles.includes("SYSTEM_ADMIN");
    const overlap = { startsAt: { lt: range.end }, endsAt: { gt: range.start }, cancelledAt: null };

    const directAudience: any[] = [
      { createdBy: user.id },
      { participants: { some: { userId: user.id } } },
    ];
    if (!panelistOnly) {
      directAudience.push({ research: { some: { research: { members: { some: { userId: user.id, leftAt: null } } } } } });
      directAudience.push({ visibility: "INSTITUTION" });
      if (user.collegeId) directAudience.push({ visibility: "COLLEGE", collegeId: user.collegeId });
      if (user.programId) directAudience.push({ visibility: "PROGRAM", programId: user.programId });
    }
    if (manager && user.collegeId) directAudience.push({ collegeId: user.collegeId });

    const [customEvents, consultations, defenses] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: systemAdmin ? overlap : { ...overlap, OR: directAudience },
        include: {
          program: { select: { id: true, code: true, name: true } },
          participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
          research: { include: { research: { select: { id: true, groupName: true, title: true } } } },
        },
        orderBy: { startsAt: "asc" },
      }),
      prisma.consultation.findMany({
        where: {
          scheduledStart: { lt: range.end }, scheduledEnd: { gt: range.start },
          OR: systemAdmin ? undefined : [
            { createdBy: user.id },
            { participants: { some: { userId: user.id } } },
            ...(!panelistOnly ? [{ research: { members: { some: { userId: user.id, leftAt: null } } } }] : []),
            ...(manager && user.collegeId ? [{ research: { collegeId: user.collegeId } }] : []),
          ],
        },
        include: { research: { select: { id: true, title: true, groupName: true, program: { select: { id: true, code: true, name: true } } } } },
        orderBy: { scheduledStart: "asc" },
      }),
      prisma.defenseSession.findMany({
        where: {
          scheduledStart: { lt: range.end }, scheduledEnd: { gt: range.start },
          status: { not: "CANCELLED" },
          OR: systemAdmin ? undefined : [
            { invitations: { some: { inviteeId: user.id, status: { not: "REMOVED" } } } },
            { research: { members: { some: { userId: user.id, leftAt: null } } } },
            ...(manager && user.collegeId ? [{ research: { collegeId: user.collegeId } }] : []),
          ],
        },
        include: { research: { select: { id: true, title: true, groupName: true, program: { select: { id: true, code: true, name: true } } } } },
        orderBy: { scheduledStart: "asc" },
      }),
    ]);

    const events = [
      ...customEvents.map((event) => ({
        id: event.id, source: "CALENDAR", type: event.type, title: event.title, description: event.description,
        startsAt: event.startsAt, endsAt: event.endsAt, allDay: event.allDay, location: event.location,
        meetingUrl: event.meetingUrl, visibility: event.visibility, program: event.program,
        groups: event.research.map((item) => ({ id: item.research.id, name: item.research.groupName || item.research.title })),
        participantNames: event.participants.map((item) => `${item.user.firstName} ${item.user.lastName}`),
      })),
      ...consultations.map((event) => ({
        id: `consultation:${event.id}`, source: "CONSULTATION", type: "CONSULTATION", title: event.title,
        description: event.description, startsAt: event.scheduledStart, endsAt: event.scheduledEnd, allDay: false,
        location: "Google Meet", meetingUrl: event.meetingUrl, visibility: "PARTICIPANTS", program: event.research.program,
        groups: [{ id: event.research.id, name: event.research.groupName || event.research.title }], participantNames: [],
      })),
      ...defenses.map((event) => ({
        id: `defense:${event.id}`, source: "DEFENSE", type: "DEFENSE", title: `${event.research.groupName || "Research group"} defense`,
        description: event.research.title, startsAt: event.scheduledStart, endsAt: event.scheduledEnd, allDay: false,
        location: event.venue, meetingUrl: event.meetingUrl, visibility: "PARTICIPANTS", program: event.research.program,
        groups: [{ id: event.research.id, name: event.research.groupName || event.research.title }], participantNames: [], status: event.status,
      })),
    ].sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime());

    res.json({ events, scope: { collegeId: user.collegeId, programId: user.programId, panelistRestricted: panelistOnly } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load the universal calendar." });
  }
});

router.post("/calendar", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const allowed = user.roles.some((role) => MANAGER_ROLES.has(role) || role === "ADVISER");
    if (!allowed) return void res.status(403).json({ error: "You do not have permission to create calendar events." });

    const { title, description, type = "OTHER", visibility = "PARTICIPANTS", startsAt, endsAt, allDay = false, location, meetingUrl, participantIds = [], researchIds = [] } = req.body;
    const start = new Date(startsAt); const end = new Date(endsAt);
    if (!String(title || "").trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      return void res.status(400).json({ error: "Title and a valid start/end schedule are required." });
    }
    if (visibility === "PROGRAM" && !user.programId) return void res.status(400).json({ error: "Your account has no assigned department/program." });
    if (["COLLEGE", "PROGRAM"].includes(visibility) && !user.collegeId) return void res.status(400).json({ error: "Your account has no assigned college." });

    const research = researchIds.length ? await prisma.researchProject.findMany({ where: { id: { in: researchIds }, ...(user.collegeId && { collegeId: user.collegeId }) }, select: { id: true } }) : [];
    if (research.length !== new Set(researchIds).size) return void res.status(403).json({ error: "One or more selected research groups are outside your scope." });

    const event = await prisma.calendarEvent.create({
      data: {
        title: String(title).trim(), description: String(description || "").trim() || null, type, visibility,
        startsAt: start, endsAt: end, allDay: Boolean(allDay), location: String(location || "").trim() || null,
        meetingUrl: String(meetingUrl || "").trim() || null, collegeId: user.collegeId || null,
        programId: visibility === "PROGRAM" ? user.programId : null, createdBy: user.id,
        participants: { create: [...new Set<string>([user.id, ...participantIds])].map((userId) => ({ userId })) },
        research: { create: research.map(({ id }) => ({ researchId: id })) },
      },
    });
    res.status(201).json({ event });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create calendar event." });
  }
});

export default router;
