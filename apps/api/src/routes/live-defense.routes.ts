import { createHash } from "node:crypto";
import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCollege, getCollegeScope } from "../lib/college-scope.js";

const router = Router();
const FACILITATOR_ROLES = new Set(["RESEARCH_COORDINATOR", "RPO", "SYSTEM_ADMIN"]);
const RECOMMENDATIONS = new Set(["APPROVE", "MINOR_REVISION", "MAJOR_REVISION", "REJECT"]);
const DECISIONS = new Set(["APPROVED", "APPROVED_WITH_MINOR_REVISIONS", "MAJOR_REVISIONS_REQUIRED", "REJECTED"]);

function requireFacilitator(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.roles.some((role) => FACILITATOR_ROLES.has(role))) {
    res.status(403).json({ error: "Defense facilitator access is required." });
    return;
  }
  next();
}

const sessionInclude = {
  research: {
    include: {
      researchType: true,
      members: {
        where: { leftAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
      documents: {
        orderBy: { currentVersion: "desc" as const },
        take: 5,
        include: { versions: { where: { status: "ACTIVE" as const }, orderBy: { versionNumber: "desc" as const }, take: 1 } },
      },
    },
  },
  evaluations: {
    include: {
      evaluator: { select: { id: true, firstName: true, lastName: true } },
      template: { include: { criteria: { orderBy: { sequence: "asc" as const } } } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  invitations: {
    include: { invitee: { select: { id: true, firstName: true, lastName: true, email: true, universityId: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

const participantSelect = { id: true, firstName: true, lastName: true, email: true, universityId: true } as const;

async function notifyResearchGroup(tx: any, researchId: string, type: any, title: string, message: string, sessionId: string) {
  const members = await tx.researchMember.findMany({
    where: { researchId, leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } },
    select: { userId: true },
  });
  if (members.length) await tx.notification.createMany({ data: members.map(({ userId }: any) => ({ recipientId: userId, type, title, message, entityType: "DefenseSession", entityId: sessionId })) });
}

router.get("/defense-management/candidates", requireAuth, requireFacilitator, async (req: Request, res: Response) => {
  try {
    const scope = getCollegeScope(req.user!);
    if (scope.kind === "unassigned") return void res.status(403).json({ error: "Your account has not been assigned to a college or school." });
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE", ...(scope.kind === "college" && { collegeId: scope.collegeId }), roles: { some: { role: { name: { in: ["PANELIST", "ADVISER"] } } } } },
      select: { ...participantSelect, roles: { select: { role: { select: { name: true } } } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    res.json({ users: users.map((user) => ({ ...user, roles: user.roles.map((item) => item.role.name) })) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load defense participants." });
  }
});

router.get("/defense-management", requireAuth, async (req: Request, res: Response) => {
  try {
    const facilitator = req.user!.roles.some((role) => FACILITATOR_ROLES.has(role));
    const panelist = req.user!.roles.includes("PANELIST") || req.user!.roles.includes("ADVISER");
    const researcher = req.user!.roles.includes("RESEARCHER");
    const scope = getCollegeScope(req.user!);
    if (scope.kind === "unassigned") return void res.status(403).json({ error: "Your account has not been assigned to a college or school." });
    const sessions = await prisma.defenseSession.findMany({
      where: facilitator ? (scope.kind === "college" ? { research: { collegeId: scope.collegeId } } : {}) : {
        OR: [
          ...(panelist ? [{ invitations: { some: { inviteeId: req.user!.id, status: { not: "REMOVED" as const } } }, ...(scope.kind === "college" && { research: { collegeId: scope.collegeId } }) }] : []),
          ...(researcher ? [{ research: { ...(scope.kind === "college" && { collegeId: scope.collegeId }), members: { some: { userId: req.user!.id, projectRole: { in: ["LEADER" as const, "MEMBER" as const] }, leftAt: null } } } }] : []),
        ],
      },
      include: sessionInclude,
      orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
    });
    if (!facilitator && panelist && !researcher) {
      sessions.forEach((session) => { session.invitations = session.invitations.filter((item) => item.inviteeId === req.user!.id); });
    }
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load defense management." });
  }
});

router.get("/defense-management/eligible-groups", requireAuth, requireFacilitator, async (req: Request, res: Response) => {
  try {
    const scope = getCollegeScope(req.user!);
    if (scope.kind === "unassigned") return void res.status(403).json({ error: "Your account has not been assigned to a college or school." });
    const projects = await prisma.researchProject.findMany({
      where: {
        ...(scope.kind === "college" && { collegeId: scope.collegeId }),
        workflowInstance: { completedAt: { not: null } },
        defenseSessions: { none: { status: { in: ["PENDING_ACKNOWLEDGEMENT", "NEEDS_RESCHEDULING", "SCHEDULED", "LIVE", "DELIBERATION"] } } },
      },
      select: { id: true, title: true, program: { select: { code: true, name: true } }, members: { where: { leftAt: null }, select: { id: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ projects });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load defense-eligible groups." });
  }
});

router.post("/defense-management", requireAuth, requireFacilitator, async (req: Request, res: Response) => {
  try {
    const researchId = String(req.body.researchId || "");
    const scheduledStart = new Date(req.body.scheduledStart);
    const scheduledEnd = new Date(req.body.scheduledEnd);
    const invitees = Array.isArray(req.body.invitees) ? req.body.invitees : [];
    if (!researchId || !Number.isFinite(scheduledStart.getTime()) || !Number.isFinite(scheduledEnd.getTime()) || scheduledEnd <= scheduledStart) {
      return void res.status(400).json({ error: "Choose a group and a valid defense start and end time." });
    }
    if (scheduledStart <= new Date()) return void res.status(400).json({ error: "Defense schedules must be in the future." });
    if (!invitees.some((item: any) => item.role === "PANEL_CHAIR") || !invitees.some((item: any) => item.role === "PANELIST")) {
      return void res.status(400).json({ error: "Assign one panel chair and at least one panelist." });
    }
    const uniqueInvitees = Array.from(new Map(invitees.map((item: any) => [String(item.userId), item])).values()) as any[];
    const research = await prisma.researchProject.findUnique({ where: { id: researchId }, include: { workflowInstance: true } });
    if (!research) return void res.status(404).json({ error: "Research group was not found." });
    if (!canAccessCollege(req.user!, research.collegeId)) return void res.status(404).json({ error: "Research group was not found in your college scope." });
    if (!research.workflowInstance?.completedAt) return void res.status(409).json({ error: "This group has not completed all workflow requirements." });
    const existing = await prisma.defenseSession.findFirst({ where: { researchId, status: { in: ["PENDING_ACKNOWLEDGEMENT", "NEEDS_RESCHEDULING", "SCHEDULED", "LIVE", "DELIBERATION"] } } });
    if (existing) return void res.status(409).json({ error: "This group already has an active defense request." });
    const validUsers = await prisma.user.findMany({ where: { id: { in: uniqueInvitees.map((item) => item.userId) }, status: "ACTIVE", collegeId: research.collegeId }, select: { id: true } });
    if (validUsers.length !== uniqueInvitees.length) return void res.status(400).json({ error: "One or more selected participants are unavailable." });

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.defenseSession.create({
        data: {
          researchId,
          status: "PENDING_ACKNOWLEDGEMENT",
          venue: String(req.body.venue || "").trim() || null,
          meetingUrl: String(req.body.meetingUrl || "").trim() || null,
          notes: String(req.body.notes || "").trim() || null,
          scheduledStart,
          scheduledEnd,
          createdBy: req.user!.id,
          invitations: { create: uniqueInvitees.map((item) => ({ inviteeId: item.userId, role: item.role, isRequired: item.isRequired !== false })) },
        },
        include: sessionInclude,
      });
      await tx.notification.createMany({ data: uniqueInvitees.map((item) => ({ recipientId: item.userId, type: "DEFENSE_INVITATION" as const, title: "Defense panel invitation", message: `You are invited to the defense of ${research.title} on ${scheduledStart.toLocaleString()}.`, entityType: "DefenseSession", entityId: created.id })) });
      await notifyResearchGroup(tx, researchId, "DEFENSE_INVITATION", "Defense schedule proposed", `A defense schedule was proposed for ${research.title}. Confirmation is pending from the invited panel.`, created.id);
      return created;
    });
    res.status(201).json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create defense request." });
  }
});

router.patch("/defense-management/invitations/:invitationId/respond", requireAuth, async (req: Request, res: Response) => {
  try {
    const response = String(req.body.response || "").toUpperCase();
    const responseNote = String(req.body.responseNote || "").trim();
    const suggestedAvailability = Array.isArray(req.body.suggestedAvailability) ? req.body.suggestedAvailability.filter(Boolean).slice(0, 3) : [];
    if (!["ACCEPTED", "DECLINED"].includes(response)) return void res.status(400).json({ error: "Choose accept or decline." });
    if (response === "DECLINED" && !responseNote) return void res.status(400).json({ error: "Please explain why you cannot attend." });
    const existing = await prisma.defenseInvitation.findUnique({ where: { id: req.params.invitationId as string }, include: { defenseSession: { include: { research: true } } } });
    if (!existing || existing.inviteeId !== req.user!.id) return void res.status(404).json({ error: "Defense invitation was not found." });
    if (!["PENDING", "RECONFIRMATION_REQUIRED"].includes(existing.status)) return void res.status(409).json({ error: "This invitation has already been answered." });

    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.defenseInvitation.update({ where: { id: existing.id }, data: { status: response as any, responseNote: responseNote || null, suggestedAvailability, respondedAt: new Date() } });
      const invitations = await tx.defenseInvitation.findMany({ where: { defenseSessionId: existing.defenseSessionId, status: { not: "REMOVED" } } });
      const required = invitations.filter((item) => item.isRequired);
      const nextStatus = required.some((item) => item.status === "DECLINED") ? "NEEDS_RESCHEDULING" : required.every((item) => item.status === "ACCEPTED") ? "SCHEDULED" : "PENDING_ACKNOWLEDGEMENT";
      const session = await tx.defenseSession.update({ where: { id: existing.defenseSessionId }, data: { status: nextStatus }, include: sessionInclude });
      if (existing.defenseSession.createdBy) await tx.notification.create({ data: { recipientId: existing.defenseSession.createdBy, type: "DEFENSE_RESPONSE", title: response === "ACCEPTED" ? "Defense invitation accepted" : "Defense invitation declined", message: `${req.user!.email} ${response === "ACCEPTED" ? "accepted" : "declined"} the defense invitation for ${existing.defenseSession.research.title}.`, entityType: "DefenseSession", entityId: session.id } });
      if (nextStatus === "SCHEDULED") await notifyResearchGroup(tx, session.researchId, "DEFENSE_CONFIRMED", "Defense schedule confirmed", `All required participants confirmed the defense schedule for ${existing.defenseSession.research.title}.`, session.id);
      else if (nextStatus === "NEEDS_RESCHEDULING") await notifyResearchGroup(tx, session.researchId, "DEFENSE_RESCHEDULED", "Defense schedule being adjusted", "One required participant is unavailable. The professor is arranging an updated schedule or replacement.", session.id);
      return { invitation, session };
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to respond to the defense invitation." });
  }
});

router.patch("/defense-management/:sessionId/reschedule", requireAuth, requireFacilitator, async (req: Request, res: Response) => {
  try {
    const scheduledStart = new Date(req.body.scheduledStart);
    const scheduledEnd = new Date(req.body.scheduledEnd);
    if (!Number.isFinite(scheduledStart.getTime()) || !Number.isFinite(scheduledEnd.getTime()) || scheduledEnd <= scheduledStart || scheduledStart <= new Date()) return void res.status(400).json({ error: "Choose a valid future start and end time." });
    const existing = await prisma.defenseSession.findUnique({ where: { id: req.params.sessionId as string }, include: { research: true, invitations: true } });
    if (!existing) return void res.status(404).json({ error: "Defense request was not found." });
    if (!canAccessCollege(req.user!, existing.research.collegeId)) return void res.status(404).json({ error: "Defense request was not found in your college scope." });
    const session = await prisma.$transaction(async (tx) => {
      await tx.defenseInvitation.updateMany({ where: { defenseSessionId: existing.id, status: { not: "REMOVED" } }, data: { status: "RECONFIRMATION_REQUIRED", respondedAt: null } });
      const updated = await tx.defenseSession.update({ where: { id: existing.id }, data: { status: "PENDING_ACKNOWLEDGEMENT", scheduledStart, scheduledEnd, venue: String(req.body.venue || "").trim() || null, meetingUrl: String(req.body.meetingUrl || "").trim() || null, notes: String(req.body.notes || "").trim() || null }, include: sessionInclude });
      await tx.notification.createMany({ data: existing.invitations.filter((item) => item.status !== "REMOVED").map((item) => ({ recipientId: item.inviteeId, type: "DEFENSE_RESCHEDULED" as const, title: "Defense schedule changed", message: `Please confirm the updated defense schedule for ${existing.research.title}.`, entityType: "DefenseSession", entityId: existing.id })) });
      await notifyResearchGroup(tx, existing.researchId, "DEFENSE_RESCHEDULED", "Defense schedule updated", `An updated defense schedule was proposed for ${existing.research.title}. Panel confirmation is pending.`, existing.id);
      return updated;
    });
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to reschedule the defense." });
  }
});

router.patch("/defense-management/:sessionId/invitations/:invitationId/replace", requireAuth, requireFacilitator, async (req: Request, res: Response) => {
  try {
    const replacementUserId = String(req.body.userId || "");
    if (!replacementUserId) return void res.status(400).json({ error: "Choose a replacement participant." });
    const existing = await prisma.defenseInvitation.findFirst({
      where: { id: req.params.invitationId as string, defenseSessionId: req.params.sessionId as string },
      include: { defenseSession: { include: { research: true } } },
    });
    if (!existing) return void res.status(404).json({ error: "Defense invitation was not found." });
    if (!canAccessCollege(req.user!, existing.defenseSession.research.collegeId)) return void res.status(404).json({ error: "Defense invitation was not found in your college scope." });
    if (existing.status !== "DECLINED") return void res.status(409).json({ error: "Only a declined participant can be replaced." });
    const replacement = await prisma.user.findFirst({ where: { id: replacementUserId, status: "ACTIVE", collegeId: existing.defenseSession.research.collegeId }, select: participantSelect });
    if (!replacement) return void res.status(400).json({ error: "The replacement participant is unavailable." });
    const duplicate = await prisma.defenseInvitation.findUnique({ where: { defenseSessionId_inviteeId: { defenseSessionId: existing.defenseSessionId, inviteeId: replacementUserId } } });
    if (duplicate && duplicate.status !== "REMOVED") return void res.status(409).json({ error: "That person is already invited to this defense." });

    const session = await prisma.$transaction(async (tx) => {
      await tx.defenseInvitation.update({ where: { id: existing.id }, data: { status: "REMOVED" } });
      if (duplicate) await tx.defenseInvitation.update({ where: { id: duplicate.id }, data: { status: "PENDING", role: existing.role, isRequired: existing.isRequired, responseNote: null, suggestedAvailability: [], respondedAt: null } });
      else await tx.defenseInvitation.create({ data: { defenseSessionId: existing.defenseSessionId, inviteeId: replacementUserId, role: existing.role, isRequired: existing.isRequired } });
      const updated = await tx.defenseSession.update({ where: { id: existing.defenseSessionId }, data: { status: "PENDING_ACKNOWLEDGEMENT" }, include: sessionInclude });
      await tx.notification.create({ data: { recipientId: replacementUserId, type: "DEFENSE_INVITATION", title: "Defense panel invitation", message: `You are invited to the defense of ${existing.defenseSession.research.title}.`, entityType: "DefenseSession", entityId: existing.defenseSessionId } });
      return updated;
    });
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to replace the unavailable participant." });
  }
});

router.get("/defense-sessions/active", requireAuth, async (req: Request, res: Response) => {
  try {
    const isPanelist = req.user!.roles.includes("PANELIST");
    const isResearcher = req.user!.roles.includes("RESEARCHER");
    const scope = getCollegeScope(req.user!);
    if (scope.kind === "unassigned") return void res.status(403).json({ error: "Your account has not been assigned to a college or school." });
    const activeMemberRoles = [
      ...(isPanelist ? ["PANELIST" as const] : []),
      ...(isResearcher ? ["LEADER" as const, "MEMBER" as const] : []),
    ];
    const session = await prisma.defenseSession.findFirst({
      where: {
        status: { in: ["LIVE", "DELIBERATION"] },
        research: {
          ...(scope.kind === "college" && { collegeId: scope.collegeId }),
          ...(activeMemberRoles.length && { members: { some: { userId: req.user!.id, projectRole: { in: activeMemberRoles }, leftAt: null } } }),
        },
      },
      include: sessionInclude,
      orderBy: { startedAt: "desc" },
    });
    if (session && isPanelist) {
      session.evaluations = session.evaluations.filter((item) => item.evaluatorId === req.user!.id);
    }
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load the active defense session." });
  }
});

router.post("/defense-sessions/start", requireAuth, requireFacilitator, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.body.sessionId || "");
    if (!sessionId) return void res.status(400).json({ error: "A confirmed defense schedule is required." });
    const scheduled = await prisma.defenseSession.findUnique({
      where: { id: sessionId },
      include: { research: { select: { collegeId: true } }, invitations: { where: { status: "ACCEPTED", role: { in: ["PANEL_CHAIR", "PANELIST"] } } } },
    });
    if (!scheduled) return void res.status(404).json({ error: "Defense schedule was not found." });
    if (!canAccessCollege(req.user!, scheduled.research.collegeId)) return void res.status(404).json({ error: "Defense schedule was not found in your college scope." });
    if (scheduled.status !== "SCHEDULED") return void res.status(409).json({ error: "All required participants must accept before the defense can start." });
    if (!scheduled.invitations.length) return void res.status(409).json({ error: "The confirmed defense has no accepted panelists." });
    const existing = await prisma.defenseSession.findFirst({ where: { status: { in: ["LIVE", "DELIBERATION"] } } });
    if (existing) {
      res.status(409).json({ error: "Another defense session is already live.", sessionId: existing.id });
      return;
    }
    const session = await prisma.$transaction(async (tx) => {
      for (const invitation of scheduled.invitations) {
        await tx.researchMember.upsert({
          where: { researchId_userId_projectRole: { researchId: scheduled.researchId, userId: invitation.inviteeId, projectRole: "PANELIST" } },
          update: { leftAt: null },
          create: { researchId: scheduled.researchId, userId: invitation.inviteeId, projectRole: "PANELIST" },
        });
      }
      return tx.defenseSession.update({ where: { id: scheduled.id }, data: { status: "LIVE", startedAt: new Date(), startedBy: req.user!.id }, include: sessionInclude });
    });
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to start the defense session." });
  }
});

router.put("/defense-sessions/:id/evaluation", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user!.roles.includes("PANELIST")) {
      res.status(403).json({ error: "Only an assigned panelist can score a live defense." });
      return;
    }
    const session = await prisma.defenseSession.findUnique({
      where: { id: req.params.id as string },
      include: {
        research: { include: { members: { where: { leftAt: null, projectRole: "PANELIST" } } } },
      },
    });
    if (!session || session.status !== "LIVE") {
      res.status(409).json({ error: "This defense session is not live." });
      return;
    }
    if (!canAccessCollege(req.user!, session.research.collegeId)) {
      res.status(404).json({ error: "Defense session was not found in your college scope." });
      return;
    }
    if (!session.research.members.some((member) => member.userId === req.user!.id)) {
      res.status(403).json({ error: "You are not assigned to this defense panel." });
      return;
    }

    const templateId = String(req.body.templateId || "");
    const recommendation = String(req.body.recommendation || "").toUpperCase();
    const final = req.body.final === true;
    const remarks = typeof req.body.remarks === "string" ? req.body.remarks.trim() : "";
    const submittedScores = Array.isArray(req.body.criteriaScores) ? req.body.criteriaScores : [];
    const template = await prisma.evaluationTemplate.findUnique({
      where: { id: templateId },
      include: { criteria: { orderBy: { sequence: "asc" } } },
    });
    if (!template || (template.researchTypeId && template.researchTypeId !== session.research.researchTypeId)) {
      res.status(400).json({ error: "The selected rubric does not belong to this research type." });
      return;
    }

    const scoreByCriterion = new Map(submittedScores.map((item: any) => [String(item.criterionId), Number(item.score)]));
    const normalizedScores = template.criteria.map((criterion) => ({
      criterionId: criterion.id,
      criterion: criterion.criterion,
      score: scoreByCriterion.get(criterion.id),
      maxScore: Number(criterion.maxScore),
      comment: String(submittedScores.find((item: any) => String(item.criterionId) === criterion.id)?.comment || "").trim(),
    }));
    const invalid = normalizedScores.some((item) => !Number.isFinite(item.score) || Number(item.score) < 0 || Number(item.score) > item.maxScore);
    if (invalid || (final && normalizedScores.length !== submittedScores.length)) {
      res.status(400).json({ error: "Every rubric criterion requires a score within its allowed range." });
      return;
    }
    if (!RECOMMENDATIONS.has(recommendation)) {
      res.status(400).json({ error: "Select a valid recommendation." });
      return;
    }
    const totalScore = normalizedScores.reduce((sum, item) => sum + Number(item.score), 0);
    if (totalScore > Number(template.totalScore)) {
      res.status(400).json({ error: "The calculated total exceeds the rubric maximum." });
      return;
    }

    const existing = await prisma.evaluation.findFirst({ where: { defenseSessionId: session.id, evaluatorId: req.user!.id } });
    if (existing?.status === "LOCKED") {
      res.status(409).json({ error: "Your final evaluation is locked and cannot be changed.", evaluation: existing });
      return;
    }
    const lockedAt = final ? new Date() : null;
    const integrityPayload = final ? JSON.stringify({ sessionId: session.id, researchId: session.researchId, evaluatorId: req.user!.id, templateId, totalScore, recommendation, normalizedScores, remarks, lockedAt: lockedAt!.toISOString() }) : null;
    const integrityHash = integrityPayload ? createHash("sha256").update(integrityPayload).digest("hex") : null;
    const data = {
      templateId,
      researchId: session.researchId,
      evaluatorId: req.user!.id,
      defenseSessionId: session.id,
      totalScore,
      recommendation: recommendation as any,
      criteriaScores: normalizedScores as any,
      remarks: remarks || null,
      status: final ? "LOCKED" as const : "DRAFT" as const,
      submittedAt: final ? lockedAt : null,
      lockedAt,
      integrityHash,
    };
    const evaluation = existing
      ? await prisma.evaluation.update({ where: { id: existing.id }, data })
      : await prisma.evaluation.create({ data });
    res.json({ evaluation, locked: final, calculatedTotal: totalScore });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save the live evaluation." });
  }
});

router.post("/defense-sessions/:id/release", requireAuth, requireFacilitator, async (req: Request, res: Response) => {
  try {
    const decision = String(req.body.decision || "").toUpperCase();
    if (!DECISIONS.has(decision)) {
      res.status(400).json({ error: "Select a valid official decision." });
      return;
    }
    const session = await prisma.defenseSession.findUnique({
      where: { id: req.params.id as string },
      include: { research: { include: { members: { where: { leftAt: null, projectRole: "PANELIST" } } } }, evaluations: true },
    });
    if (!session || !["LIVE", "DELIBERATION"].includes(session.status)) {
      res.status(409).json({ error: "This session cannot be released." });
      return;
    }
    if (!canAccessCollege(req.user!, session.research.collegeId)) {
      res.status(404).json({ error: "Defense session was not found in your college scope." });
      return;
    }
    const lockedEvaluatorIds = new Set(session.evaluations.filter((item) => item.status === "LOCKED").map((item) => item.evaluatorId));
    const missing = session.research.members.filter((member) => !lockedEvaluatorIds.has(member.userId));
    if (missing.length) {
      res.status(409).json({ error: `Waiting for ${missing.length} panelist evaluation(s).` });
      return;
    }
    const researchStatus = decision === "REJECTED" ? "REJECTED" : decision === "MAJOR_REVISIONS_REQUIRED" ? "REVISION" : "APPROVED";
    const result = await prisma.$transaction(async (tx) => {
      const completed = await tx.defenseSession.update({
        where: { id: session.id },
        data: { status: "COMPLETED", decision: decision as any, endedAt: new Date(), releasedAt: new Date(), releasedBy: req.user!.id },
        include: sessionInclude,
      });
      await tx.researchProject.update({ where: { id: session.researchId }, data: { status: researchStatus } });
      return completed;
    });
    res.json({ session: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to release the official defense result." });
  }
});

router.get("/defense-sessions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await prisma.defenseSession.findUnique({ where: { id: req.params.id as string }, include: sessionInclude });
    if (!session) {
      res.status(404).json({ error: "Defense session was not found." });
      return;
    }
    if (!canAccessCollege(req.user!, session.research.collegeId)) {
      res.status(404).json({ error: "Defense session was not found in your college scope." });
      return;
    }
    const isInstitutionWide = getCollegeScope(req.user!).kind === "institution";
    const isFacilitator = req.user!.roles.includes("RESEARCH_COORDINATOR");
    const isMember = session.research.members.some((member) => member.userId === req.user!.id);
    const isInvited = session.invitations.some((invitation) => invitation.inviteeId === req.user!.id && invitation.status !== "REMOVED");
    if (!isInstitutionWide && !isFacilitator && !isMember && !isInvited) {
      res.status(404).json({ error: "Defense session was not found." });
      return;
    }
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load the defense session." });
  }
});

router.get("/research/:researchId/defense-result", requireAuth, async (req: Request, res: Response) => {
  try {
    const researchId = req.params.researchId as string;
    const research = await prisma.researchProject.findUnique({ where: { id: researchId }, select: { collegeId: true } });
    if (!research || !canAccessCollege(req.user!, research.collegeId)) {
      res.status(404).json({ error: "Defense result was not found in your college scope." });
      return;
    }
    const isResearcher = req.user!.roles.includes("RESEARCHER");
    if (isResearcher) {
      const membership = await prisma.researchMember.findFirst({ where: { researchId, userId: req.user!.id, projectRole: { in: ["LEADER", "MEMBER"] }, leftAt: null } });
      if (!membership) {
        res.status(403).json({ error: "You do not have access to this defense result." });
        return;
      }
    }
    const session = await prisma.defenseSession.findFirst({
      where: { researchId, status: "COMPLETED", releasedAt: { not: null } },
      select: { id: true, decision: true, releasedAt: true, endedAt: true },
      orderBy: { releasedAt: "desc" },
    });
    res.json({ result: session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load the official defense result." });
  }
});

export default router;
