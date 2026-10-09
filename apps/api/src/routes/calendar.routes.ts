import { Router, Request, Response } from "express";
import { Permissions } from "@research-management/auth";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();
const SCOPE_MANAGER_ROLES = new Set(["RESEARCH_COORDINATOR", "RPO", "REB", "VPAA", "SYSTEM_ADMIN"]);
const EVENT_TYPES = new Set(["ACADEMIC", "CONSULTATION", "DEFENSE", "DEADLINE", "MILESTONE", "ANNOUNCEMENT", "AVAILABILITY", "OTHER"]);
const VISIBILITIES = new Set(["PARTICIPANTS", "PROGRAM", "COLLEGE", "INSTITUTION"]);
const AVAILABILITY_STATUSES = new Set(["UNAVAILABLE", "ON_LEAVE", "OUT_OF_OFFICE", "LIMITED_AVAILABILITY"]);

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

function parseSchedule(body: any) {
  const start = new Date(body.startsAt);
  const end = new Date(body.endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return null;
  return { start, end };
}

function hasPermission(req: Request, permission: string) {
  return Boolean(req.user?.permissions.includes(permission));
}

function isPanelistOnly(req: Request) {
  return req.user!.roles.includes("PANELIST") &&
    !req.user!.roles.some((role) => SCOPE_MANAGER_ROLES.has(role) || role === "ADVISER");
}

function canEditEvent(req: Request, event: { createdBy: string; collegeId?: string | null }) {
  const managesScope = hasPermission(req, Permissions.CALENDAR_MANAGE) &&
    (req.user!.roles.includes("SYSTEM_ADMIN") || !req.user!.collegeId || event.collegeId === req.user!.collegeId);
  return managesScope ||
    (event.createdBy === req.user!.id && hasPermission(req, Permissions.CALENDAR_EDIT_OWN));
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item || "")).filter(Boolean))).slice(0, 200)
    : [];
}

async function resolveAudience(req: Request, participantIds: string[], researchIds: string[]) {
  const user = req.user!;
  const [people, research] = await Promise.all([
    participantIds.length
      ? prisma.user.findMany({
          where: { id: { in: participantIds }, status: "ACTIVE", ...(user.collegeId && { collegeId: user.collegeId }) },
          select: { id: true },
        })
      : [],
    researchIds.length
      ? prisma.researchProject.findMany({
          where: { id: { in: researchIds }, status: { not: "ARCHIVED" }, ...(user.collegeId && { collegeId: user.collegeId }) },
          select: { id: true, members: { where: { leftAt: null }, select: { userId: true } } },
        })
      : [],
  ]);

  if (people.length !== participantIds.length) throw new Error("One or more selected people are outside your calendar scope.");
  if (research.length !== researchIds.length) throw new Error("One or more selected research groups are outside your calendar scope.");

  const audienceUserIds = new Set<string>([user.id, ...people.map((person) => person.id)]);
  research.forEach((project) => project.members.forEach((member) => audienceUserIds.add(member.userId)));
  return { people, research, audienceUserIds: Array.from(audienceUserIds) };
}

async function findAvailabilityConflicts(userIds: string[], start: Date, end: Date, excludeEventId?: string) {
  if (!userIds.length) return [];
  const events = await prisma.calendarEvent.findMany({
    where: {
      id: excludeEventId ? { not: excludeEventId } : undefined,
      type: "AVAILABILITY",
      blocksScheduling: true,
      cancelledAt: null,
      startsAt: { lt: end },
      endsAt: { gt: start },
      createdBy: { in: userIds },
    },
    include: { creator: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { startsAt: "asc" },
  });
  return events.map((event) => ({
    eventId: event.id,
    userId: event.creator.id,
    name: `${event.creator.firstName} ${event.creator.lastName}`,
    status: event.availabilityStatus,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
  }));
}

router.get("/calendar/options", requireAuth, requirePermission(Permissions.CALENDAR_VIEW), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const canCreate = hasPermission(req, Permissions.CALENDAR_CREATE);
    const canManageAvailability = hasPermission(req, Permissions.CALENDAR_AVAILABILITY_MANAGE);
    if (!canCreate && !canManageAvailability) {
      return void res.json({ canCreate: false, canManageAvailability: false, groups: [], people: [] });
    }

    const scopeManager = user.roles.some((role) => SCOPE_MANAGER_ROLES.has(role));
    const [groups, people] = canCreate
      ? await Promise.all([
          prisma.researchProject.findMany({
            where: {
              ...(user.collegeId && { collegeId: user.collegeId }),
              ...(!scopeManager && { members: { some: { userId: user.id, projectRole: "ADVISER", leftAt: null } } }),
              status: { not: "ARCHIVED" },
            },
            select: { id: true, groupName: true, title: true, program: { select: { code: true } } },
            orderBy: { updatedAt: "desc" },
            take: 100,
          }),
          prisma.user.findMany({
            where: { status: "ACTIVE", ...(user.collegeId && { collegeId: user.collegeId }) },
            select: { id: true, firstName: true, lastName: true, program: { select: { code: true } }, roles: { select: { role: { select: { name: true } } } } },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            take: 200,
          }),
        ])
      : [[], []];

    res.json({
      canCreate,
      canManageAvailability,
      canManageAll: hasPermission(req, Permissions.CALENDAR_MANAGE),
      groups: groups.map((group: any) => ({ id: group.id, name: group.groupName || group.title, programCode: group.program.code })),
      people: people.map((person: any) => ({ id: person.id, name: `${person.firstName} ${person.lastName}`, programCode: person.program?.code, roles: person.roles.map((item: any) => item.role.name) })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load calendar scheduling options." });
  }
});

router.get("/calendar", requireAuth, requirePermission(Permissions.CALENDAR_VIEW), async (req: Request, res: Response) => {
  try {
    const range = parseRange(req);
    if (!range) return void res.status(400).json({ error: "Choose a valid calendar range of up to one year." });
    const user = req.user!;
    const scopeManager = user.roles.some((role) => SCOPE_MANAGER_ROLES.has(role));
    const panelistOnly = isPanelistOnly(req);
    const systemAdmin = user.roles.includes("SYSTEM_ADMIN");
    const overlap = { startsAt: { lt: range.end }, endsAt: { gt: range.start }, cancelledAt: null };

    const directAudience: any[] = [{ createdBy: user.id }, { participants: { some: { userId: user.id } } }];
    if (!panelistOnly) {
      directAudience.push({ research: { some: { research: { members: { some: { userId: user.id, leftAt: null } } } } } });
      directAudience.push({ visibility: "INSTITUTION" });
      if (user.collegeId) directAudience.push({ visibility: "COLLEGE", collegeId: user.collegeId });
      if (user.programId) directAudience.push({ visibility: "PROGRAM", programId: user.programId });
    }
    if (scopeManager && user.collegeId) directAudience.push({ collegeId: user.collegeId });

    const [customEvents, consultations, defenses] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: systemAdmin ? overlap : { ...overlap, OR: directAudience },
        include: {
          creator: { select: { id: true, firstName: true, lastName: true } },
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
            ...(scopeManager && user.collegeId ? [{ research: { collegeId: user.collegeId } }] : []),
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
            ...(scopeManager && user.collegeId ? [{ research: { collegeId: user.collegeId } }] : []),
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
        meetingUrl: event.meetingUrl, visibility: event.visibility, availabilityStatus: event.availabilityStatus,
        blocksScheduling: event.blocksScheduling, privateNotes: canEditEvent(req, event) ? event.privateNotes : null,
        creator: { id: event.creator.id, name: `${event.creator.firstName} ${event.creator.lastName}` },
        canEdit: canEditEvent(req, event), program: event.program,
        groups: event.research.map((item) => ({ id: item.research.id, name: item.research.groupName || item.research.title })),
        participantIds: event.participants.map((item) => item.user.id),
        participantNames: event.participants.map((item) => `${item.user.firstName} ${item.user.lastName}`),
      })),
      ...consultations.map((event) => ({
        id: `consultation:${event.id}`, source: "CONSULTATION", type: "CONSULTATION", title: event.title,
        description: event.description, startsAt: event.scheduledStart, endsAt: event.scheduledEnd, allDay: false,
        location: "Google Meet", meetingUrl: event.meetingUrl, visibility: "PARTICIPANTS", program: event.research.program,
        groups: [{ id: event.research.id, name: event.research.groupName || event.research.title }], participantIds: [], participantNames: [], canEdit: false,
      })),
      ...defenses.map((event) => ({
        id: `defense:${event.id}`, source: "DEFENSE", type: "DEFENSE", title: `${event.research.groupName || "Research group"} defense`,
        description: event.research.title, startsAt: event.scheduledStart, endsAt: event.scheduledEnd, allDay: false,
        location: event.venue, meetingUrl: event.meetingUrl, visibility: "PARTICIPANTS", program: event.research.program,
        groups: [{ id: event.research.id, name: event.research.groupName || event.research.title }], participantIds: [], participantNames: [], status: event.status, canEdit: false,
      })),
    ].sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime());

    res.json({ events, scope: { collegeId: user.collegeId, programId: user.programId, panelistRestricted: panelistOnly } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load the universal calendar." });
  }
});

router.post("/calendar/conflicts", requireAuth, requirePermission(Permissions.CALENDAR_CREATE), async (req: Request, res: Response) => {
  try {
    const schedule = parseSchedule(req.body);
    if (!schedule) return void res.status(400).json({ error: "Choose a valid start and end schedule." });
    const audience = await resolveAudience(req, stringList(req.body.participantIds), stringList(req.body.researchIds));
    const conflicts = await findAvailabilityConflicts(audience.audienceUserIds, schedule.start, schedule.end, req.body.excludeEventId ? String(req.body.excludeEventId) : undefined);
    res.json({ conflicts });
  } catch (error: any) {
    const status = String(error.message || "").includes("outside your calendar scope") ? 403 : 500;
    res.status(status).json({ error: error.message || "Failed to check calendar conflicts." });
  }
});

router.post("/calendar", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const type = String(req.body.type || "OTHER").toUpperCase();
    const isAvailability = type === "AVAILABILITY";
    const allowed = isAvailability ? hasPermission(req, Permissions.CALENDAR_AVAILABILITY_MANAGE) : hasPermission(req, Permissions.CALENDAR_CREATE);
    if (!allowed) return void res.status(403).json({ error: "You do not have permission to create this calendar entry." });
    if (!EVENT_TYPES.has(type)) return void res.status(400).json({ error: "Choose a valid calendar event type." });

    const schedule = parseSchedule(req.body);
    const visibility = String(req.body.visibility || "PARTICIPANTS").toUpperCase();
    const participantIds = isAvailability ? [] : stringList(req.body.participantIds);
    const researchIds = isAvailability ? [] : stringList(req.body.researchIds);
    const availabilityStatus = isAvailability ? String(req.body.availabilityStatus || "UNAVAILABLE").toUpperCase() : null;
    const title = String(req.body.title || "").trim();
    if (!schedule || (!isAvailability && !title)) return void res.status(400).json({ error: "Title and a valid start/end schedule are required." });
    if (!VISIBILITIES.has(visibility)) return void res.status(400).json({ error: "Choose a valid event visibility." });
    if (visibility === "INSTITUTION" && !hasPermission(req, Permissions.CALENDAR_MANAGE)) return void res.status(403).json({ error: "Only calendar managers can publish institution-wide entries." });
    if (availabilityStatus && !AVAILABILITY_STATUSES.has(availabilityStatus)) return void res.status(400).json({ error: "Choose a valid availability status." });
    if (visibility === "PROGRAM" && !user.programId) return void res.status(400).json({ error: "Your account has no assigned department/program." });
    if (["COLLEGE", "PROGRAM"].includes(visibility) && !user.collegeId) return void res.status(400).json({ error: "Your account has no assigned college." });

    const audience = await resolveAudience(req, participantIds, researchIds);
    const event = await prisma.calendarEvent.create({
      data: {
        title: (isAvailability ? title || "Unavailable" : title).slice(0, 200),
        description: String(req.body.description || "").trim() || null, type: type as any, visibility: visibility as any,
        startsAt: schedule.start, endsAt: schedule.end, allDay: Boolean(req.body.allDay),
        location: isAvailability ? null : String(req.body.location || "").trim().slice(0, 200) || null,
        meetingUrl: isAvailability ? null : String(req.body.meetingUrl || "").trim().slice(0, 500) || null,
        availabilityStatus: availabilityStatus as any, blocksScheduling: isAvailability && req.body.blocksScheduling !== false,
        privateNotes: isAvailability ? String(req.body.privateNotes || "").trim() || null : null,
        collegeId: user.collegeId || null, programId: visibility === "PROGRAM" ? user.programId : null, createdBy: user.id,
        participants: { create: [...new Set<string>([user.id, ...audience.people.map((person) => person.id)])].map((userId) => ({ userId })) },
        research: { create: audience.research.map(({ id }) => ({ researchId: id })) },
      },
    });
    res.status(201).json({ event });
  } catch (error: any) {
    const status = String(error.message || "").includes("outside your calendar scope") ? 403 : 500;
    res.status(status).json({ error: error.message || "Failed to create calendar event." });
  }
});

router.patch("/calendar/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.calendarEvent.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.cancelledAt) return void res.status(404).json({ error: "Calendar event not found." });
    if (!canEditEvent(req, existing)) return void res.status(403).json({ error: "You cannot edit this calendar event." });

    const type = String(req.body.type || existing.type).toUpperCase();
    const isAvailability = type === "AVAILABILITY";
    if (!EVENT_TYPES.has(type)) return void res.status(400).json({ error: "Choose a valid calendar event type." });
    if (isAvailability && !hasPermission(req, Permissions.CALENDAR_AVAILABILITY_MANAGE) && !hasPermission(req, Permissions.CALENDAR_MANAGE)) {
      return void res.status(403).json({ error: "You cannot manage availability entries." });
    }
    if (!isAvailability && !hasPermission(req, Permissions.CALENDAR_CREATE) && !hasPermission(req, Permissions.CALENDAR_MANAGE)) {
      return void res.status(403).json({ error: "You cannot create general calendar events." });
    }

    const schedule = parseSchedule(req.body);
    const visibility = String(req.body.visibility || existing.visibility).toUpperCase();
    const participantIds = isAvailability ? [] : stringList(req.body.participantIds);
    const researchIds = isAvailability ? [] : stringList(req.body.researchIds);
    const availabilityStatus = isAvailability ? String(req.body.availabilityStatus || existing.availabilityStatus || "UNAVAILABLE").toUpperCase() : null;
    const title = String(req.body.title || "").trim();
    if (!schedule || (!isAvailability && !title)) return void res.status(400).json({ error: "Title and a valid start/end schedule are required." });
    if (!VISIBILITIES.has(visibility)) return void res.status(400).json({ error: "Choose a valid event visibility." });
    if (visibility === "INSTITUTION" && !hasPermission(req, Permissions.CALENDAR_MANAGE)) return void res.status(403).json({ error: "Only calendar managers can publish institution-wide entries." });
    if (availabilityStatus && !AVAILABILITY_STATUSES.has(availabilityStatus)) return void res.status(400).json({ error: "Choose a valid availability status." });
    if (visibility === "PROGRAM" && !req.user!.programId) return void res.status(400).json({ error: "Your account has no assigned department/program." });
    if (["COLLEGE", "PROGRAM"].includes(visibility) && !req.user!.collegeId) return void res.status(400).json({ error: "Your account has no assigned college." });

    const audience = await resolveAudience(req, participantIds, researchIds);
    const event = await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: {
        title: (isAvailability ? title || "Unavailable" : title).slice(0, 200),
        description: String(req.body.description || "").trim() || null, type: type as any, visibility: visibility as any,
        startsAt: schedule.start, endsAt: schedule.end, allDay: Boolean(req.body.allDay),
        location: isAvailability ? null : String(req.body.location || "").trim().slice(0, 200) || null,
        meetingUrl: isAvailability ? null : String(req.body.meetingUrl || "").trim().slice(0, 500) || null,
        availabilityStatus: availabilityStatus as any, blocksScheduling: isAvailability && req.body.blocksScheduling !== false,
        privateNotes: isAvailability ? String(req.body.privateNotes || "").trim() || null : null,
        programId: visibility === "PROGRAM" ? req.user!.programId : null,
        participants: { deleteMany: {}, create: [...new Set<string>([existing.createdBy, ...audience.people.map((person) => person.id)])].map((userId) => ({ userId })) },
        research: { deleteMany: {}, create: audience.research.map(({ id }) => ({ researchId: id })) },
      },
    });
    res.json({ event });
  } catch (error: any) {
    const status = String(error.message || "").includes("outside your calendar scope") ? 403 : 500;
    res.status(status).json({ error: error.message || "Failed to update calendar event." });
  }
});

router.delete("/calendar/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.calendarEvent.findUnique({ where: { id: String(req.params.id) }, select: { id: true, createdBy: true, collegeId: true, cancelledAt: true } });
    if (!existing || existing.cancelledAt) return void res.status(404).json({ error: "Calendar event not found." });
    if (!canEditEvent(req, existing)) return void res.status(403).json({ error: "You cannot cancel this calendar event." });
    await prisma.calendarEvent.update({ where: { id: existing.id }, data: { cancelledAt: new Date() } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to cancel calendar event." });
  }
});

export default router;
