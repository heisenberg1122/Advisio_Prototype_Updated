import {
  defenseAudience,
  defenseSchedulerAudience,
} from "../services/notification.service.js";
import { createHash } from "node:crypto";
import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCollege, getCollegeScope } from "../lib/college-scope.js";
import { jsonSafe } from "../lib/json-response.js";
import { defensePacketService } from "../services/defense-packet.service.js";
import {
  getMilestoneProgress,
  advanceMilestoneIfSatisfied,
  createNotificationsOnce,
} from "../services/research-workflow-integration.service.js";
import { hasDefenseFacilitatorAccess } from "../services/defense-manuscript.service.js";
import {
  canIssueDefenseBadge,
  defenseBadgeKind,
} from "../services/defense-badge-policy.js";
import {
  currentPanelInvitation,
  EvaluationScoreError,
  liveDefenseConflictScope,
  normalizeEvaluationScores,
} from "../services/defense-session-policy.js";

import {
  activeDefenseStatuses,
  approveDefenseEligibility,
  currentDefenseEligibility,
  requireDefenseEligibility,
  lockDefenseGroup,
  consumeDefenseEligibility,
} from "../services/defense-eligibility.service.js";

const router = Router();

// Pending and approved gates are displayed separately from groups that have
// both eligibility and a signed Dean letter and can actually be scheduled.
router.get(
  "/defense-management/eligibility-gates",
  requireAuth,
  requireFacilitator,
  async (req, res) => {
    try {
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned")
        return void res
          .status(403)
          .json({ error: "College assignment is required." });
      const projects = await prisma.researchProject.findMany({
        where: {
          ...(scope.kind === "college" && { collegeId: scope.collegeId }),
          workflowInstance: {
            workflow: {
              status: "PUBLISHED",
              stages: {
                some: {
                  milestoneType: "DEFENSE_ELIGIBILITY",
                  category: { not: "Archived" },
                },
              },
            },
          },
        },
        select: { id: true, title: true, groupName: true },
      });
      const groups = [];
      for (const project of projects) {
        const progress = await getMilestoneProgress(prisma, project.id);
        const grants = await prisma.defenseEligibility.findMany({
          where: { researchId: project.id },
        });
        const gate = progress.find(
          (item) =>
            item.milestoneType === "DEFENSE_ELIGIBILITY" &&
            !grants.some(
              (grant) => grant.milestoneId === item.id && grant.consumedAt,
            ),
        );
        if (!gate) continue;
        groups.push({
          ...project,
          milestone: gate,
          approved: grants.some((grant) => grant.milestoneId === gate.id),
          canApprove:
            !gate.isBlocked &&
            (!gate.requiresDocument || gate.documentRequirementSatisfied) &&
            gate.tasks.every(
              (task) => !task.isRequired || task.status === "APPROVED",
            ),
        });
      }
      res.json({ groups });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  },
);

router.post(
  "/defense-management/eligibility/:researchId/:milestoneId/approve",
  requireAuth,
  requireFacilitator,
  async (req, res) => {
    try {
      const researchId = String(req.params.researchId);
      const project = await prisma.researchProject.findUnique({
        where: { id: researchId },
        select: {
          collegeId: true,
          workflowInstance: {
            select: { workflow: { select: { status: true } } },
          },
        },
      });
      if (!project || !canAccessCollege(req.user!, project.collegeId))
        return void res
          .status(404)
          .json({ error: "Research group not found in your college scope." });
      if (project.workflowInstance?.workflow.status !== "PUBLISHED")
        return void res
          .status(409)
          .json({
            error: "Publish the workflow before approving defense eligibility.",
          });
      const eligibility = await prisma.$transaction(async (tx) => {
        const approval = await approveDefenseEligibility(tx, {
          researchId,
          milestoneId: String(req.params.milestoneId),
          actorId: req.user!.id,
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "APPROVE",
            entityType: "DefenseEligibility",
            entityId: approval.id,
            newValues: { researchId, milestoneId: approval.milestoneId },
          },
        });
        await advanceMilestoneIfSatisfied(tx, {
          researchId,
          milestoneId: approval.milestoneId,
          actorId: req.user!.id,
        });
        await notifyResearchGroup(
          tx,
          researchId,
          "WORKFLOW_CHANGED",
          "Defense eligibility approved",
          "Your group is approved for one defense cycle. A signed Dean approval is required before scheduling.",
          approval.id,
        );
        return approval;
      });
      res.json({ eligibility });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  },
);

// Delete removes an accidental request from the active schedule, preserving
// its invitations, packet, and audit history as a cancelled session.
router.delete(
  "/defense-management/:sessionId",
  requireAuth,
  requireFacilitator,
  async (req, res) => {
    try {
      const sessionId = String(req.params.sessionId);
      if (req.body.confirmation !== `DELETE ${sessionId}`)
        return void res
          .status(400)
          .json({
            error: "Confirm deletion of this specific defense session.",
          });
      const session = await prisma.defenseSession.findUnique({
        where: { id: sessionId },
        include: { research: { select: { collegeId: true } } },
      });
      if (!session || !canAccessCollege(req.user!, session.research.collegeId))
        return void res
          .status(404)
          .json({ error: "Defense session not found in your college scope." });
      await prisma.$transaction(async (tx) => {
        await lockDefenseGroup(tx, session.researchId);
        const cancelled = await tx.defenseSession.updateMany({
          where: {
            id: sessionId,
            startedAt: null,
            releasedAt: null,
            status: {
              in: [
                "SCHEDULED",
                "PENDING_ACKNOWLEDGEMENT",
                "NEEDS_RESCHEDULING",
              ],
            },
          },
          data: { status: "CANCELLED" },
        });
        if (!cancelled.count)
          throw Object.assign(
            new Error(
              "Only an unstarted defense session can be deleted. Live and completed defense records are preserved.",
            ),
            { statusCode: 409 },
          );
        const invitations = await tx.defenseInvitation.findMany({
          where: { defenseSessionId: sessionId, status: { not: "REMOVED" } },
        });
        await tx.defenseInvitation.updateMany({
          where: { defenseSessionId: sessionId },
          data: { status: "REMOVED" },
        });
        await tx.notification.createMany({
          data: invitations.map((item) => ({
            audience: defenseAudience(item.role),
            recipientId: item.inviteeId,
            type: "DEFENSE_RESCHEDULED",
            title: "Defense session cancelled",
            message:
              "The coordinator removed an accidental defense request. The previous schedule and invitation are cancelled.",
            entityType: "DefenseSession",
            entityId: sessionId,
          })),
        });
        await notifyResearchGroup(
          tx,
          session.researchId,
          "DEFENSE_RESCHEDULED",
          "Defense session cancelled",
          "Your defense schedule was cancelled. Your defense eligibility remains available for a new schedule.",
          sessionId,
        );
        if (session.defenseEventId) {
          const remaining = await tx.defenseSession.count({
            where: {
              defenseEventId: session.defenseEventId,
              status: { not: "CANCELLED" },
            },
          });
          if (!remaining)
            await tx.defenseEvent.update({
              where: { id: session.defenseEventId },
              data: { status: "CANCELLED" },
            });
          else await syncDefenseEventStatus(tx, session.defenseEventId);
        }
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "DELETE",
            entityType: "DefenseSession",
            entityId: sessionId,
            newValues: { status: "CANCELLED", eligibilityPreserved: true },
          },
        });
      });
      res.json({ deleted: true });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  },
);
const RECOMMENDATIONS = new Set([
  "APPROVE",
  "MINOR_REVISION",
  "MAJOR_REVISION",
  "REJECT",
]);
const DECISIONS = new Set([
  "APPROVED",
  "APPROVED_WITH_MINOR_REVISIONS",
  "MAJOR_REVISIONS_REQUIRED",
  "REJECTED",
]);

function requireFacilitator(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !hasDefenseFacilitatorAccess(req.user)) {
    res.status(403).json({ error: "Defense facilitator access is required." });
    return;
  }
  next();
}

const sessionInclude = {
  badge: {
    include: { issuer: { select: { firstName: true, lastName: true } } },
  },
  pdfEvaluations: {
    select: {
      id: true,
      panelistId: true,
      status: true,
      lockedAt: true,
      signedAt: true,
      updatedAt: true,
    },
  },
  defenseEvent: {
    select: {
      id: true,
      code: true,
      defenseType: true,
      status: true,
      scheduledStart: true,
      scheduledEnd: true,
      venue: true,
      meetingUrl: true,
    },
  },
  research: {
    include: {
      researchType: true,
      program: { select: { id: true, code: true, name: true } },
      college: { select: { id: true, code: true, name: true } },
      academicYear: { select: { id: true, name: true } },
      workflowInstance: {
        select: {
          currentStage: { select: { id: true, name: true, sequence: true } },
        },
      },
      members: {
        where: { leftAt: null },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      adviserRequests: {
        where: { status: "ACCEPTED" as const },
        include: {
          adviser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { respondedAt: "desc" as const },
      },
      documents: {
        orderBy: { currentVersion: "desc" as const },
        take: 5,
        select: {
          id: true,
          title: true,
          documentType: true,
          currentVersion: true,
          versions: {
            where: { status: "ACTIVE" as const },
            orderBy: { versionNumber: "desc" as const },
            take: 1,
            select: {
              id: true,
              documentId: true,
              versionNumber: true,
              fileName: true,
              mimeType: true,
              storagePath: true,
              googleDriveFileId: true,
              uploadedBy: true,
              uploadedAt: true,
              status: true,
            },
          },
        },
      },
    },
  },
  evaluations: {
    include: {
      evaluator: { select: { id: true, firstName: true, lastName: true } },
      template: {
        include: { criteria: { orderBy: { sequence: "asc" as const } } },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  manuscriptReviews: {
    select: {
      id: true,
      panelistId: true,
      reviewedAt: true,
      updatedAt: true,
    },
  },
  recommendations: {
    select: {
      id: true,
      panelistId: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
    },
  },
  invitations: {
    include: {
      invitee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          universityId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  packet: {
    select: {
      id: true,
      status: true,
      manuscriptVersionId: true,
      publishedAt: true,
      reviewDeadline: true,
      mappingVersion: true,
      evaluationMode: true,
      evaluationSignatureRequired: true,
      evaluationTemplateVersionId: true,
      manuscriptVersion: {
        select: {
          id: true,
          versionNumber: true,
          fileName: true,
          mimeType: true,
          manuscriptStatus: true,
          isImmutable: true,
          contentChecksum: true,
          submittedAt: true,
          milestone: { select: { id: true, name: true, sequence: true } },
          document: { select: { id: true, title: true, researchId: true } },
        },
      },
    },
  },
};

const eventInclude = {
  creator: { select: { id: true, firstName: true, lastName: true } },
  sessions: {
    where: { status: { not: "CANCELLED" as const } },
    include: sessionInclude,
    orderBy: [
      { queuePosition: "asc" as const },
      { scheduledStart: "asc" as const },
    ],
  },
};

function panelistDeliveryMode(session: any) {
  const venue = session.venue || session.defenseEvent?.venue;
  const meetingUrl = session.meetingUrl || session.defenseEvent?.meetingUrl;
  if (venue && meetingUrl) return "HYBRID";
  if (meetingUrl) return "ONLINE";
  if (venue) return "ON_SITE";
  return "TO_BE_ANNOUNCED";
}

function scopeSessionForPanelist(session: any, userId: string) {
  const invitation = currentPanelInvitation(session.invitations, userId);
  const accepted = invitation?.status === "ACCEPTED";
  return {
    ...session,
    deliveryMode: panelistDeliveryMode(session),
    meetingUrl: accepted ? session.meetingUrl : null,
    defenseEvent: session.defenseEvent
      ? {
          ...session.defenseEvent,
          meetingUrl: accepted ? session.defenseEvent.meetingUrl : null,
        }
      : null,
    invitations: session.invitations.filter(
      (item: any) => item.inviteeId === userId,
    ),
    evaluations: session.evaluations.filter(
      (item: any) => item.evaluatorId === userId,
    ),
    pdfEvaluations: (session.pdfEvaluations || []).filter(
      (item: any) => item.panelistId === userId,
    ),
    manuscriptReviews: session.manuscriptReviews.filter(
      (item: any) => item.panelistId === userId,
    ),
    recommendations: session.recommendations.filter(
      (item: any) => item.panelistId === userId,
    ),
    research: { ...session.research, documents: [] },
    packet: accepted
      ? session.packet
      : session.packet
        ? {
            id: session.packet.id,
            status: session.packet.status,
            publishedAt: session.packet.publishedAt,
            reviewDeadline: session.packet.reviewDeadline,
          }
        : null,
  };
}

const participantSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  universityId: true,
} as const;

async function notifyResearchGroup(
  tx: any,
  researchId: string,
  type: any,
  title: string,
  message: string,
  sessionId: string,
) {
  const members = await tx.researchMember.findMany({
    where: {
      researchId,
      leftAt: null,
      projectRole: { in: ["LEADER", "MEMBER"] },
    },
    select: { userId: true },
  });
  if (members.length)
    await tx.notification.createMany({
      data: members.map(({ userId }: any) => ({
        audience: "researcher",
        recipientId: userId,
        type,
        title,
        message,
        entityType: "DefenseSession",
        entityId: sessionId,
      })),
    });
}

async function nextDefenseEventCode() {
  const year = new Date().getFullYear();
  const prefix = `DEF-${year}-`;
  const latest = await prisma.defenseEvent.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const sequence = Number(latest?.code.slice(prefix.length)) || 0;
  return `${prefix}${String(sequence + 1).padStart(3, "0")}`;
}

async function syncDefenseEventStatus(tx: any, eventId: string | null) {
  if (!eventId) return;
  const event = await tx.defenseEvent.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      sessions: {
        where: { status: { not: "CANCELLED" } },
        select: { status: true, queueStatus: true },
      },
    },
  });
  if (!event || ["ONGOING", "COMPLETED", "CANCELLED"].includes(event.status))
    return;
  const ready =
    event.sessions.length > 0 &&
    event.sessions.every((session: any) => session.status === "SCHEDULED");
  await tx.defenseEvent.update({
    where: { id: eventId },
    data: { status: ready ? "READY" : "DRAFT" },
  });
}

router.get(
  "/defense-events",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned")
        return void res.status(403).json({
          error: "Your account has not been assigned to a college or school.",
        });
      const events = await prisma.defenseEvent.findMany({
        where: {
          status: { not: "CANCELLED" },
          ...(scope.kind === "college" ? { collegeId: scope.collegeId } : {}),
        },
        include: eventInclude,
        orderBy: [{ scheduledStart: "desc" }, { createdAt: "desc" }],
      });
      res.json({ events });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to load defense events." });
    }
  },
);

router.post(
  "/defense-events",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const researchIds: string[] = Array.from(
        new Set<string>(
          (Array.isArray(req.body.researchIds) ? req.body.researchIds : [])
            .map((value: unknown) => String(value))
            .filter(Boolean),
        ),
      );
      const scheduledStart = new Date(req.body.scheduledStart);
      const scheduledEnd = new Date(req.body.scheduledEnd);
      const invitees = Array.isArray(req.body.invitees)
        ? req.body.invitees
        : [];
      if (
        !researchIds.length ||
        !Number.isFinite(scheduledStart.getTime()) ||
        !Number.isFinite(scheduledEnd.getTime()) ||
        scheduledEnd <= scheduledStart
      ) {
        return void res.status(400).json({
          error:
            "Choose at least one group and a valid event start and end time.",
        });
      }
      if (scheduledStart <= new Date())
        return void res
          .status(400)
          .json({ error: "Defense events must be scheduled in the future." });
      const slotDuration = Math.floor(
        (scheduledEnd.getTime() - scheduledStart.getTime()) /
          researchIds.length,
      );
      if (slotDuration < 15 * 60 * 1000)
        return void res.status(400).json({
          error: "Allow at least 15 minutes for every research group.",
        });
      if (
        !invitees.some((item: any) => item.role === "PANEL_CHAIR") ||
        !invitees.some((item: any) => item.role === "PANELIST")
      ) {
        return void res
          .status(400)
          .json({ error: "Assign one panel chair and at least one panelist." });
      }
      const uniqueInvitees = Array.from(
        new Map(
          invitees.map((item: any) => [String(item.userId), item]),
        ).values(),
      ) as any[];
      const projects = await prisma.researchProject.findMany({
        where: { id: { in: researchIds } },
        include: { workflowInstance: true },
      });
      if (projects.length !== researchIds.length)
        return void res
          .status(404)
          .json({ error: "One or more research groups were not found." });
      if (
        projects.some(
          (project) => !canAccessCollege(req.user!, project.collegeId),
        )
      )
        return void res.status(404).json({
          error: "One or more research groups are outside your college scope.",
        });
      const collegeIds = new Set(projects.map((project) => project.collegeId));
      if (collegeIds.size !== 1)
        return void res.status(400).json({
          error:
            "A defense event can only contain groups from the same college.",
        });
      const activeSession = await prisma.defenseSession.findFirst({
        where: {
          researchId: { in: researchIds },
          status: {
            in: [
              "PENDING_ACKNOWLEDGEMENT",
              "NEEDS_RESCHEDULING",
              "SCHEDULED",
              "LIVE",
              "DELIBERATION",
            ],
          },
        },
        select: { researchId: true },
      });
      if (activeSession)
        return void res.status(409).json({
          error:
            "One of the selected groups already has an active defense request.",
        });
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: uniqueInvitees.map((item) => item.userId) },
          status: "ACTIVE",
          collegeId: projects[0].collegeId,
        },
        select: { id: true },
      });
      if (validUsers.length !== uniqueInvitees.length)
        return void res.status(400).json({
          error: "One or more selected participants are unavailable.",
        });

      const code = await nextDefenseEventCode();
      const projectById = new Map(
        projects.map((project) => [project.id, project]),
      );
      const event = await prisma.$transaction(async (tx) => {
        const eligibilityByResearch = new Map<string, string>();
        for (const researchId of [...researchIds].sort()) {
          await lockDefenseGroup(tx, researchId);
          const eligibility = await requireDefenseEligibility(tx, researchId);
          eligibilityByResearch.set(researchId, eligibility.id);
        }
        const createdEvent = await tx.defenseEvent.create({
          data: {
            code,
            collegeId: projects[0].collegeId,
            defenseType:
              String(req.body.defenseType || "RESEARCH_DEFENSE")
                .trim()
                .slice(0, 80) || "RESEARCH_DEFENSE",
            scheduledStart,
            scheduledEnd,
            venue: String(req.body.venue || "").trim() || null,
            meetingUrl: String(req.body.meetingUrl || "").trim() || null,
            notes: String(req.body.notes || "").trim() || null,
            createdBy: req.user!.id,
          },
        });
        for (const [index, researchId] of researchIds.entries()) {
          const groupStart = new Date(
            scheduledStart.getTime() + slotDuration * index,
          );
          const groupEnd =
            index === researchIds.length - 1
              ? scheduledEnd
              : new Date(groupStart.getTime() + slotDuration);
          const session = await tx.defenseSession.create({
            data: {
              researchId,
              eligibilityId: eligibilityByResearch.get(researchId),
              defenseEventId: createdEvent.id,
              queuePosition: index + 1,
              status: "PENDING_ACKNOWLEDGEMENT",
              venue: createdEvent.venue,
              meetingUrl: createdEvent.meetingUrl,
              notes: createdEvent.notes,
              scheduledStart: groupStart,
              scheduledEnd: groupEnd,
              createdBy: req.user!.id,
              invitations: {
                create: uniqueInvitees.map((item) => ({
                  inviteeId: item.userId,
                  role: item.role,
                  isRequired: item.isRequired !== false,
                })),
              },
            },
          });
          const project = projectById.get(researchId)!;
          await notifyResearchGroup(
            tx,
            researchId,
            "DEFENSE_INVITATION",
            `${code} defense schedule proposed`,
            `Your group is queue ${index + 1} in ${code}. Panel confirmation is pending.`,
            session.id,
          );
        }
        await tx.notification.createMany({
          data: uniqueInvitees.map((item) => ({
            audience: defenseAudience(item.role),
            recipientId: item.userId,
            type: "DEFENSE_INVITATION" as const,
            title: `${code} panel invitation`,
            message: `You are invited to a defense event with ${researchIds.length} research ${researchIds.length === 1 ? "group" : "groups"} on ${scheduledStart.toLocaleString()}. One response confirms the full event.`,
            entityType: "DefenseEvent",
            entityId: createdEvent.id,
          })),
        });
        return tx.defenseEvent.findUniqueOrThrow({
          where: { id: createdEvent.id },
          include: eventInclude,
        });
      });
      res.status(201).json({ event });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to create the defense event.",
      });
    }
  },
);

router.patch(
  "/defense-events/:eventId/queue/:sessionId",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const action = String(req.body.action || "").toUpperCase();
      if (!["PREPARE", "CALL", "DELAY", "SKIP"].includes(action))
        return void res
          .status(400)
          .json({ error: "Choose a valid queue action." });
      const session = await prisma.defenseSession.findFirst({
        where: {
          id: req.params.sessionId as string,
          defenseEventId: req.params.eventId as string,
        },
        include: {
          research: true,
          packet: {
            select: { id: true, status: true, manuscriptVersionId: true },
          },
          invitations: {
            where: {
              status: "ACCEPTED",
              role: { in: ["PANEL_CHAIR", "PANELIST"] },
            },
          },
        },
      });
      if (!session)
        return void res
          .status(404)
          .json({ error: "The queued defense was not found." });
      if (!canAccessCollege(req.user!, session.research.collegeId))
        return void res.status(404).json({
          error: "The queued defense was not found in your college scope.",
        });

      const event = await prisma.$transaction(async (tx) => {
        await lockDefenseGroup(tx, session.researchId);
        const current = await tx.defenseSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        if (current.status !== session.status || current.status === "CANCELLED")
          throw Object.assign(
            new Error(
              "This session changed. Refresh before updating the queue.",
            ),
            { statusCode: 409 },
          );
        if (action === "PREPARE") {
          if (
            !["SCHEDULED", "PENDING_ACKNOWLEDGEMENT"].includes(session.status)
          )
            throw new Error(
              "This group cannot be prepared in its current state.",
            );
          await tx.defenseSession.update({
            where: { id: session.id },
            data: { queueStatus: "PREPARE_NEXT", preparedAt: new Date() },
          });
          await notifyResearchGroup(
            tx,
            session.researchId,
            "DEFENSE_CONFIRMED",
            "Prepare for your defense",
            `Your group is next for ${session.research.title}. Please proceed to the assigned venue when called.`,
            session.id,
          );
        }
        if (action === "CALL") {
          if (session.status !== "SCHEDULED")
            throw new Error(
              "All required panelists must confirm before this group can be called.",
            );
          if (session.packet?.status !== "PUBLISHED")
            throw new Error(
              "Publish an eligible approved manuscript packet before calling this defense.",
            );
          const active = await tx.defenseSession.findFirst({
            where: {
              id: { not: session.id },
              status: { in: ["LIVE", "DELIBERATION"] },
              ...liveDefenseConflictScope(session),
            },
            select: { id: true },
          });
          if (active)
            throw new Error(
              session.defenseEventId
                ? "Complete or release the live defense for this event or research project before calling another group."
                : "Complete or release the live defense for this research project before calling another group.",
            );
          for (const invitation of session.invitations) {
            await tx.researchMember.upsert({
              where: {
                researchId_userId_projectRole: {
                  researchId: session.researchId,
                  userId: invitation.inviteeId,
                  projectRole: "PANELIST",
                },
              },
              update: { leftAt: null },
              create: {
                researchId: session.researchId,
                userId: invitation.inviteeId,
                projectRole: "PANELIST",
              },
            });
          }
          await tx.defenseSession.update({
            where: { id: session.id },
            data: {
              status: "LIVE",
              queueStatus: "IN_PROGRESS",
              calledAt: new Date(),
              startedAt: new Date(),
              startedBy: req.user!.id,
            },
          });
          await tx.defenseEvent.update({
            where: { id: session.defenseEventId! },
            data: { status: "ONGOING", startedAt: new Date() },
          });
          await notifyResearchGroup(
            tx,
            session.researchId,
            "DEFENSE_CONFIRMED",
            "Your defense is starting",
            "Your group has been called. Please proceed to the assigned defense venue now.",
            session.id,
          );
        }
        if (action === "DELAY")
          await tx.defenseSession.update({
            where: { id: session.id },
            data: { queueStatus: "DELAYED" },
          });
        if (action === "SKIP")
          await tx.defenseSession.update({
            where: { id: session.id },
            data: { queueStatus: "SKIPPED" },
          });
        return tx.defenseEvent.findUniqueOrThrow({
          where: { id: session.defenseEventId! },
          include: eventInclude,
        });
      });
      res.json({ event });
    } catch (error: any) {
      const status = /cannot|must|before/.test(error.message || "") ? 409 : 500;
      res.status(status).json({
        error: error.message || "Failed to update the defense queue.",
      });
    }
  },
);

router.get(
  "/defense-management/candidates",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned")
        return void res.status(403).json({
          error: "Your account has not been assigned to a college or school.",
        });
      const users = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          ...(scope.kind === "college" && { collegeId: scope.collegeId }),
          roles: { some: { role: { name: { in: ["PANELIST", "ADVISER"] } } } },
        },
        select: {
          ...participantSelect,
          roles: { select: { role: { select: { name: true } } } },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
      res.json({
        users: users.map((user) => ({
          ...user,
          roles: user.roles.map((item) => item.role.name),
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to load defense participants.",
      });
    }
  },
);

router.get(
  "/defense-management",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const facilitator = hasDefenseFacilitatorAccess(req.user!);
      const panelist =
        req.user!.roles.includes("PANELIST") ||
        req.user!.roles.includes("ADVISER");
      const researcher = req.user!.roles.includes("RESEARCHER");
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned")
        return void res.status(403).json({
          error: "Your account has not been assigned to a college or school.",
        });
      const sessions = await prisma.defenseSession.findMany({
        where: facilitator
          ? scope.kind === "college"
            ? { research: { collegeId: scope.collegeId } }
            : {}
          : {
              OR: [
                ...(panelist
                  ? [
                      {
                        invitations: {
                          some: {
                            inviteeId: req.user!.id,
                            status: { not: "REMOVED" as const },
                          },
                        },
                      },
                    ]
                  : []),
                ...(researcher
                  ? [
                      {
                        research: {
                          ...(scope.kind === "college" && {
                            collegeId: scope.collegeId,
                          }),
                          members: {
                            some: {
                              userId: req.user!.id,
                              projectRole: {
                                in: ["LEADER" as const, "MEMBER" as const],
                              },
                              leftAt: null,
                            },
                          },
                        },
                      },
                    ]
                  : []),
              ],
            },
        include: sessionInclude,
        orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
      });
      if (!facilitator && researcher) {
        sessions.forEach((session) => {
          session.evaluations = [];
        });
      } else if (!facilitator && panelist) {
        sessions.forEach((session) => {
          session.invitations = session.invitations.filter(
            (item) => item.inviteeId === req.user!.id,
          );
          session.evaluations = session.evaluations.filter(
            (item) => item.evaluatorId === req.user!.id,
          );
          session.research.documents = [];
        });
      }
      res.json({ sessions });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to load defense management." });
    }
  },
);

router.get(
  "/panelist/dashboard-summary",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user!.roles.includes("PANELIST")) {
        return void res
          .status(403)
          .json({ error: "Panelist access is required." });
      }
      const now = new Date();
      const sessions = await prisma.defenseSession.findMany({
        where: {
          invitations: {
            some: {
              inviteeId: req.user!.id,
              role: { in: ["PANELIST", "PANEL_CHAIR"] },
              status: { not: "REMOVED" },
            },
          },
        },
        include: {
          ...sessionInclude,
          manuscriptReviews: { where: { panelistId: req.user!.id } },
          recommendations: { where: { panelistId: req.user!.id } },
        },
        orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
      });

      const scopedSessions = sessions.map((session) =>
        scopeSessionForPanelist(session, req.user!.id),
      );
      const accepted = scopedSessions.filter(
        (session) => session.invitations[0]?.status === "ACCEPTED",
      );
      const assignedProjects = Array.from(
        new Map(
          accepted.map((session) => [
            session.research.id,
            {
              ...session.research,
              defenseSessionId: session.id,
              defenseStatus: session.status,
              invitationStatus: session.invitations[0]?.status,
              scheduledStart: session.scheduledStart,
              packetStatus: session.packet?.status || null,
            },
          ]),
        ).values(),
      );
      const pendingReviews = accepted.filter(
        (session) =>
          session.packet?.status === "PUBLISHED" &&
          !session.manuscriptReviews[0]?.reviewedAt,
      );
      const pendingEvaluations = accepted.filter(
        (session) =>
          session.status === "LIVE" &&
          (session.packet?.evaluationMode === "PDF"
            ? session.pdfEvaluations?.[0]?.status !== "LOCKED"
            : session.evaluations[0]?.status !== "LOCKED"),
      );
      const completedEvaluations = accepted.filter(
        (session) => session.evaluations[0]?.status === "LOCKED",
      );
      const completedPdfEvaluations = accepted.filter(
        (session) =>
          session.packet?.evaluationMode === "PDF" &&
          session.pdfEvaluations?.[0]?.status === "LOCKED",
      );
      const upcomingSessions = accepted.filter(
        (session) =>
          Boolean(session.scheduledStart && session.scheduledStart >= now) &&
          !["COMPLETED", "CANCELLED"].includes(session.status),
      );
      const archives = accepted.filter(
        (session) => session.status === "COMPLETED",
      );

      res.json({
        sessions: scopedSessions,
        assignedProjects,
        pendingReviews,
        pendingEvaluations,
        completedEvaluations,
        completedPdfEvaluations,
        upcomingSessions,
        archives,
        counts: {
          assignedProjects: assignedProjects.length,
          pendingInvitations: scopedSessions.filter((session) =>
            ["PENDING", "RECONFIRMATION_REQUIRED"].includes(
              session.invitations[0]?.status || "",
            ),
          ).length,
          upcomingDefenses: upcomingSessions.filter(
            (session) => session.status === "SCHEDULED",
          ).length,
          rescheduling: accepted.filter(
            (session) => session.status === "NEEDS_RESCHEDULING",
          ).length,
          archivedDefenses: archives.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to load the panelist dashboard.",
      });
    }
  },
);

router.get(
  "/defense-management/eligible-groups",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned")
        return void res.status(403).json({
          error: "Your account has not been assigned to a college or school.",
        });
      const candidates = await prisma.researchProject.findMany({
        where: {
          ...(scope.kind === "college" && { collegeId: scope.collegeId }),
          workflowInstance: { isNot: null },
          defenseSessions: {
            none: { status: { in: [...activeDefenseStatuses] } },
          },
        },
        select: {
          id: true,
          title: true,
          groupName: true,
          collegeId: true,
          members: { where: { leftAt: null }, select: { id: true } },
          program: { select: { code: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
      const projects = [];
      for (const project of candidates) {
        const eligibility = await currentDefenseEligibility(prisma, project.id);
        if (!eligibility) continue;
        if (req.query.purpose !== "signature") {
          try {
            await requireDefenseEligibility(prisma, project.id);
          } catch (error: any) {
            if (error.statusCode === 409) continue;
            throw error;
          }
        }
        projects.push({ ...project, eligibility });
      }
      res.json({ projects });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to load defense-eligible groups.",
      });
    }
  },
);

router.post(
  "/defense-management",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const researchId = String(req.body.researchId || "");
      const scheduledStart = new Date(req.body.scheduledStart);
      const scheduledEnd = new Date(req.body.scheduledEnd);
      const invitees = Array.isArray(req.body.invitees)
        ? req.body.invitees
        : [];
      if (
        !researchId ||
        !Number.isFinite(scheduledStart.getTime()) ||
        !Number.isFinite(scheduledEnd.getTime()) ||
        scheduledEnd <= scheduledStart
      ) {
        return void res.status(400).json({
          error: "Choose a group and a valid defense start and end time.",
        });
      }
      if (scheduledStart <= new Date())
        return void res
          .status(400)
          .json({ error: "Defense schedules must be in the future." });
      if (
        !invitees.some((item: any) => item.role === "PANEL_CHAIR") ||
        !invitees.some((item: any) => item.role === "PANELIST")
      ) {
        return void res
          .status(400)
          .json({ error: "Assign one panel chair and at least one panelist." });
      }
      const uniqueInvitees = Array.from(
        new Map(
          invitees.map((item: any) => [String(item.userId), item]),
        ).values(),
      ) as any[];
      const research = await prisma.researchProject.findUnique({
        where: { id: researchId },
        include: { workflowInstance: true },
      });
      if (!research)
        return void res
          .status(404)
          .json({ error: "Research group was not found." });
      if (!canAccessCollege(req.user!, research.collegeId))
        return void res.status(404).json({
          error: "Research group was not found in your college scope.",
        });
      const existing = await prisma.defenseSession.findFirst({
        where: {
          researchId,
          status: {
            in: [
              "PENDING_ACKNOWLEDGEMENT",
              "NEEDS_RESCHEDULING",
              "SCHEDULED",
              "LIVE",
              "DELIBERATION",
            ],
          },
        },
      });
      if (existing)
        return void res
          .status(409)
          .json({ error: "This group already has an active defense request." });
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: uniqueInvitees.map((item) => item.userId) },
          status: "ACTIVE",
          collegeId: research.collegeId,
        },
        select: { id: true },
      });
      if (validUsers.length !== uniqueInvitees.length)
        return void res.status(400).json({
          error: "One or more selected participants are unavailable.",
        });

      const session = await prisma.$transaction(async (tx) => {
        await lockDefenseGroup(tx, researchId);
        const eligibility = await requireDefenseEligibility(tx, researchId);
        const created = await tx.defenseSession.create({
          data: {
            researchId,
            eligibilityId: eligibility.id,
            status: "PENDING_ACKNOWLEDGEMENT",
            venue: String(req.body.venue || "").trim() || null,
            meetingUrl: String(req.body.meetingUrl || "").trim() || null,
            notes: String(req.body.notes || "").trim() || null,
            scheduledStart,
            scheduledEnd,
            createdBy: req.user!.id,
            invitations: {
              create: uniqueInvitees.map((item) => ({
                inviteeId: item.userId,
                role: item.role,
                isRequired: item.isRequired !== false,
              })),
            },
          },
          include: sessionInclude,
        });
        await tx.notification.createMany({
          data: uniqueInvitees.map((item) => ({
            audience: defenseAudience(item.role),
            recipientId: item.userId,
            type: "DEFENSE_INVITATION" as const,
            title: "Defense panel invitation",
            message: `You are invited to the defense of ${research.title} on ${scheduledStart.toLocaleString()}.`,
            entityType: "DefenseSession",
            entityId: created.id,
          })),
        });
        await notifyResearchGroup(
          tx,
          researchId,
          "DEFENSE_INVITATION",
          "Defense schedule proposed",
          `A defense schedule was proposed for ${research.title}. Confirmation is pending from the invited panel.`,
          created.id,
        );
        return created;
      });
      res.status(201).json({ session });
    } catch (error: any) {
      res
        .status(error.statusCode || 500)
        .json({ error: error.message || "Failed to create defense request." });
    }
  },
);

router.patch(
  "/defense-management/invitations/:invitationId/respond",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const response = String(req.body.response || "").toUpperCase();
      const responseNote = String(req.body.responseNote || "").trim();
      const suggestedAvailability = Array.isArray(
        req.body.suggestedAvailability,
      )
        ? req.body.suggestedAvailability.filter(Boolean).slice(0, 3)
        : [];
      if (!["ACCEPTED", "DECLINED"].includes(response))
        return void res
          .status(400)
          .json({ error: "Choose accept or decline." });
      if (response === "DECLINED" && !responseNote)
        return void res
          .status(400)
          .json({ error: "Please explain why you cannot attend." });
      const existing = await prisma.defenseInvitation.findUnique({
        where: { id: req.params.invitationId as string },
        include: { defenseSession: { include: { research: true } } },
      });
      if (!existing || existing.inviteeId !== req.user!.id)
        return void res
          .status(404)
          .json({ error: "Defense invitation was not found." });
      if (!["PENDING", "RECONFIRMATION_REQUIRED"].includes(existing.status))
        return void res
          .status(409)
          .json({ error: "This invitation has already been answered." });

      const result = await prisma.$transaction(async (tx) => {
        const affected = await tx.defenseSession.findMany({
          where: existing.defenseSession.defenseEventId
            ? { defenseEventId: existing.defenseSession.defenseEventId }
            : { id: existing.defenseSessionId },
          select: { id: true, researchId: true },
        });
        for (const researchId of [
          ...new Set(affected.map((item) => item.researchId)),
        ].sort())
          await lockDefenseGroup(tx, researchId);
        const activeSessions = await tx.defenseSession.findMany({
          where: {
            id: { in: affected.map((item) => item.id) },
            status: {
              in: [
                "PENDING_ACKNOWLEDGEMENT",
                "NEEDS_RESCHEDULING",
                "SCHEDULED",
              ],
            },
            startedAt: null,
          },
          select: { id: true },
        });
        const sessionIds = activeSessions.map((item) => item.id);
        if (!sessionIds.includes(existing.defenseSessionId))
          throw Object.assign(
            new Error("This defense invitation is no longer active."),
            { statusCode: 409 },
          );
        await tx.defenseInvitation.updateMany({
          where: {
            defenseSessionId: { in: sessionIds },
            inviteeId: existing.inviteeId,
            status: { in: ["PENDING", "RECONFIRMATION_REQUIRED"] },
          },
          data: {
            status: response as any,
            responseNote: responseNote || null,
            suggestedAvailability,
            respondedAt: new Date(),
          },
        });
        let session: any = null;
        let nextStatus = "PENDING_ACKNOWLEDGEMENT";
        for (const sessionId of sessionIds) {
          const invitations = await tx.defenseInvitation.findMany({
            where: { defenseSessionId: sessionId, status: { not: "REMOVED" } },
          });
          const required = invitations.filter((item) => item.isRequired);
          nextStatus = required.some((item) => item.status === "DECLINED")
            ? "NEEDS_RESCHEDULING"
            : required.every((item) => item.status === "ACCEPTED")
              ? "SCHEDULED"
              : "PENDING_ACKNOWLEDGEMENT";
          const updated = await tx.defenseSession.update({
            where: { id: sessionId },
            data: { status: nextStatus as any },
            include: sessionInclude,
          });
          if (sessionId === existing.defenseSessionId) session = updated;
          if (nextStatus === "SCHEDULED")
            await notifyResearchGroup(
              tx,
              updated.researchId,
              "DEFENSE_CONFIRMED",
              "Defense schedule confirmed",
              "All required participants confirmed the defense event.",
              updated.id,
            );
          else if (nextStatus === "NEEDS_RESCHEDULING")
            await notifyResearchGroup(
              tx,
              updated.researchId,
              "DEFENSE_RESCHEDULED",
              "Defense schedule being adjusted",
              "One required participant is unavailable. The professor is arranging an updated schedule or replacement.",
              updated.id,
            );
        }
        await syncDefenseEventStatus(
          tx,
          existing.defenseSession.defenseEventId,
        );
        const invitation = await tx.defenseInvitation.findUniqueOrThrow({
          where: { id: existing.id },
        });
        if (existing.defenseSession.createdBy)
          await tx.notification.create({
            data: {
              audience: await defenseSchedulerAudience(
                tx,
                existing.defenseSession.createdBy,
                existing.defenseSession.researchId,
              ),
              recipientId: existing.defenseSession.createdBy,
              type: "DEFENSE_RESPONSE",
              title:
                response === "ACCEPTED"
                  ? "Defense invitation accepted"
                  : "Defense invitation declined",
              message: `${req.user!.email} ${response === "ACCEPTED" ? "accepted" : "declined"} the defense invitation for ${existing.defenseSession.research.title}.`,
              entityType: "DefenseSession",
              entityId: session.id,
            },
          });
        return { invitation, session };
      });
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        error: error.message || "Failed to respond to the defense invitation.",
      });
    }
  },
);

router.patch(
  "/defense-management/:sessionId/reschedule",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const scheduledStart = new Date(req.body.scheduledStart);
      const scheduledEnd = new Date(req.body.scheduledEnd);
      if (
        !Number.isFinite(scheduledStart.getTime()) ||
        !Number.isFinite(scheduledEnd.getTime()) ||
        scheduledEnd <= scheduledStart ||
        scheduledStart <= new Date()
      )
        return void res
          .status(400)
          .json({ error: "Choose a valid future start and end time." });
      const existing = await prisma.defenseSession.findUnique({
        where: { id: req.params.sessionId as string },
        include: { research: true, invitations: true },
      });
      if (!existing)
        return void res
          .status(404)
          .json({ error: "Defense request was not found." });
      if (!canAccessCollege(req.user!, existing.research.collegeId))
        return void res.status(404).json({
          error: "Defense request was not found in your college scope.",
        });
      const session = await prisma.$transaction(async (tx) => {
        await lockDefenseGroup(tx, existing.researchId);
        const current = await tx.defenseSession.findUniqueOrThrow({
          where: { id: existing.id },
        });
        if (
          ![
            "PENDING_ACKNOWLEDGEMENT",
            "NEEDS_RESCHEDULING",
            "SCHEDULED",
          ].includes(current.status) ||
          current.startedAt
        )
          throw Object.assign(
            new Error(
              "Only unstarted active defense sessions can be rescheduled.",
            ),
            { statusCode: 409 },
          );
        await tx.defenseInvitation.updateMany({
          where: { defenseSessionId: existing.id, status: { not: "REMOVED" } },
          data: { status: "RECONFIRMATION_REQUIRED", respondedAt: null },
        });
        const updated = await tx.defenseSession.update({
          where: { id: existing.id },
          data: {
            status: "PENDING_ACKNOWLEDGEMENT",
            scheduledStart,
            scheduledEnd,
            venue: String(req.body.venue || "").trim() || null,
            meetingUrl: String(req.body.meetingUrl || "").trim() || null,
            notes: String(req.body.notes || "").trim() || null,
          },
          include: sessionInclude,
        });
        await syncDefenseEventStatus(tx, updated.defenseEventId);
        await tx.notification.createMany({
          data: existing.invitations
            .filter((item) => item.status !== "REMOVED")
            .map((item) => ({
              audience: defenseAudience(item.role),
              recipientId: item.inviteeId,
              type: "DEFENSE_RESCHEDULED" as const,
              title: "Defense schedule changed",
              message: `Please confirm the updated defense schedule for ${existing.research.title}.`,
              entityType: "DefenseSession",
              entityId: existing.id,
            })),
        });
        await notifyResearchGroup(
          tx,
          existing.researchId,
          "DEFENSE_RESCHEDULED",
          "Defense schedule updated",
          `An updated defense schedule was proposed for ${existing.research.title}. Panel confirmation is pending.`,
          existing.id,
        );
        return updated;
      });
      res.json({ session });
    } catch (error: any) {
      res
        .status(error.statusCode || 500)
        .json({ error: error.message || "Failed to reschedule the defense." });
    }
  },
);

router.patch(
  "/defense-management/:sessionId/invitations/:invitationId/replace",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const replacementUserId = String(req.body.userId || "");
      if (!replacementUserId)
        return void res
          .status(400)
          .json({ error: "Choose a replacement participant." });
      const existing = await prisma.defenseInvitation.findFirst({
        where: {
          id: req.params.invitationId as string,
          defenseSessionId: req.params.sessionId as string,
        },
        include: { defenseSession: { include: { research: true } } },
      });
      if (!existing)
        return void res
          .status(404)
          .json({ error: "Defense invitation was not found." });
      if (
        !canAccessCollege(req.user!, existing.defenseSession.research.collegeId)
      )
        return void res.status(404).json({
          error: "Defense invitation was not found in your college scope.",
        });
      if (existing.status !== "DECLINED")
        return void res
          .status(409)
          .json({ error: "Only a declined participant can be replaced." });
      const replacement = await prisma.user.findFirst({
        where: {
          id: replacementUserId,
          status: "ACTIVE",
          collegeId: existing.defenseSession.research.collegeId,
        },
        select: participantSelect,
      });
      if (!replacement)
        return void res
          .status(400)
          .json({ error: "The replacement participant is unavailable." });
      const duplicate = await prisma.defenseInvitation.findUnique({
        where: {
          defenseSessionId_inviteeId: {
            defenseSessionId: existing.defenseSessionId,
            inviteeId: replacementUserId,
          },
        },
      });
      if (duplicate && duplicate.status !== "REMOVED")
        return void res
          .status(409)
          .json({ error: "That person is already invited to this defense." });

      const session = await prisma.$transaction(async (tx) => {
        await lockDefenseGroup(tx, existing.defenseSession.researchId);
        const current = await tx.defenseSession.findUniqueOrThrow({
          where: { id: existing.defenseSessionId },
        });
        if (
          ![
            "PENDING_ACKNOWLEDGEMENT",
            "NEEDS_RESCHEDULING",
            "SCHEDULED",
          ].includes(current.status) ||
          current.startedAt
        )
          throw Object.assign(
            new Error("This defense session is no longer editable."),
            { statusCode: 409 },
          );
        await tx.defenseInvitation.update({
          where: { id: existing.id },
          data: { status: "REMOVED" },
        });
        if (duplicate)
          await tx.defenseInvitation.update({
            where: { id: duplicate.id },
            data: {
              status: "PENDING",
              role: existing.role,
              isRequired: existing.isRequired,
              responseNote: null,
              suggestedAvailability: [],
              respondedAt: null,
            },
          });
        else
          await tx.defenseInvitation.create({
            data: {
              defenseSessionId: existing.defenseSessionId,
              inviteeId: replacementUserId,
              role: existing.role,
              isRequired: existing.isRequired,
            },
          });
        const updated = await tx.defenseSession.update({
          where: { id: existing.defenseSessionId },
          data: { status: "PENDING_ACKNOWLEDGEMENT" },
          include: sessionInclude,
        });
        await tx.notification.create({
          data: {
            audience: defenseAudience(existing.role),
            recipientId: replacementUserId,
            type: "DEFENSE_INVITATION",
            title: "Defense panel invitation",
            message: `You are invited to the defense of ${existing.defenseSession.research.title}.`,
            entityType: "DefenseSession",
            entityId: existing.defenseSessionId,
          },
        });
        return updated;
      });
      res.json({ session });
    } catch (error: any) {
      res.status(500).json({
        error:
          error.message || "Failed to replace the unavailable participant.",
      });
    }
  },
);

router.get(
  "/defense-sessions/active",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const isPanelist = req.user!.roles.includes("PANELIST");
      const isResearcher = req.user!.roles.includes("RESEARCHER");
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned")
        return void res.status(403).json({
          error: "Your account has not been assigned to a college or school.",
        });
      const participantScope = [
        ...(isPanelist
          ? [
              {
                invitations: {
                  some: {
                    inviteeId: req.user!.id,
                    status: "ACCEPTED" as const,
                    role: { in: ["PANEL_CHAIR" as const, "PANELIST" as const] },
                  },
                },
              },
            ]
          : []),
        ...(isResearcher
          ? [
              {
                research: {
                  members: {
                    some: {
                      userId: req.user!.id,
                      projectRole: {
                        in: ["LEADER" as const, "MEMBER" as const],
                      },
                      leftAt: null,
                    },
                  },
                },
              },
            ]
          : []),
      ];
      const session = await prisma.defenseSession.findFirst({
        where: {
          status: { in: ["LIVE", "DELIBERATION"] },
          ...(scope.kind === "college" &&
            !isPanelist && {
              research: { collegeId: scope.collegeId },
            }),
          ...(req.query.sessionId && { id: String(req.query.sessionId) }),
          ...(participantScope.length && { OR: participantScope }),
        },
        include: sessionInclude,
        orderBy: { startedAt: "desc" },
      });
      if (session && isPanelist) {
        session.pdfEvaluations = session.pdfEvaluations.filter(
          (item) => item.panelistId === req.user!.id,
        );
        session.evaluations = session.evaluations.filter(
          (item) => item.evaluatorId === req.user!.id,
        );
        session.manuscriptReviews = session.manuscriptReviews.filter(
          (item) => item.panelistId === req.user!.id,
        );
        session.recommendations = session.recommendations.filter(
          (item) => item.panelistId === req.user!.id,
        );
        session.research.documents = [];
      }
      res.json({ session });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to load the active defense session.",
      });
    }
  },
);

router.post(
  "/defense-sessions/start",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const sessionId = String(req.body.sessionId || "");
      if (!sessionId)
        return void res
          .status(400)
          .json({ error: "A confirmed defense schedule is required." });
      const scheduled = await prisma.defenseSession.findUnique({
        where: { id: sessionId },
        include: {
          research: { select: { collegeId: true } },
          packet: {
            select: { id: true, status: true, manuscriptVersionId: true },
          },
          invitations: {
            where: {
              status: "ACCEPTED",
              role: { in: ["PANEL_CHAIR", "PANELIST"] },
            },
          },
        },
      });
      if (!scheduled)
        return void res
          .status(404)
          .json({ error: "Defense schedule was not found." });
      if (!canAccessCollege(req.user!, scheduled.research.collegeId))
        return void res.status(404).json({
          error: "Defense schedule was not found in your college scope.",
        });
      if (scheduled.status !== "SCHEDULED")
        return void res.status(409).json({
          error:
            "All required participants must accept before the defense can start.",
        });
      if (!scheduled.invitations.length)
        return void res
          .status(409)
          .json({ error: "The confirmed defense has no accepted panelists." });
      if (scheduled.packet?.status !== "PUBLISHED")
        return void res.status(409).json({
          error:
            "Publish an eligible approved manuscript packet before starting the defense.",
        });
      const existing = await prisma.defenseSession.findFirst({
        where: {
          status: { in: ["LIVE", "DELIBERATION"] },
          ...liveDefenseConflictScope(scheduled),
        },
      });
      if (existing) {
        res.status(409).json({
          error: scheduled.defenseEventId
            ? "Another defense for this event or research project is already live."
            : "Another defense for this research project is already live.",
          sessionId: existing.id,
        });
        return;
      }
      const session = await prisma.$transaction(async (tx) => {
        await lockDefenseGroup(tx, scheduled.researchId);
        const current = await tx.defenseSession.findUniqueOrThrow({
          where: { id: scheduled.id },
        });
        if (current.status !== "SCHEDULED")
          throw Object.assign(
            new Error("This defense is no longer scheduled."),
            { statusCode: 409 },
          );
        for (const invitation of scheduled.invitations) {
          await tx.researchMember.upsert({
            where: {
              researchId_userId_projectRole: {
                researchId: scheduled.researchId,
                userId: invitation.inviteeId,
                projectRole: "PANELIST",
              },
            },
            update: { leftAt: null },
            create: {
              researchId: scheduled.researchId,
              userId: invitation.inviteeId,
              projectRole: "PANELIST",
            },
          });
        }
        const updated = await tx.defenseSession.update({
          where: { id: scheduled.id },
          data: {
            status: "LIVE",
            queueStatus: scheduled.defenseEventId ? "IN_PROGRESS" : undefined,
            calledAt: scheduled.defenseEventId ? new Date() : undefined,
            startedAt: new Date(),
            startedBy: req.user!.id,
          },
          include: sessionInclude,
        });
        if (scheduled.defenseEventId)
          await tx.defenseEvent.update({
            where: { id: scheduled.defenseEventId },
            data: { status: "ONGOING", startedAt: new Date() },
          });
        return updated;
      });
      res.json({ session });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to start the defense session.",
      });
    }
  },
);

router.put(
  "/defense-sessions/:id/evaluation",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user!.roles.includes("PANELIST")) {
        res.status(403).json({
          error: "Only an assigned panelist can score a live defense.",
        });
        return;
      }
      const session = await prisma.defenseSession.findUnique({
        where: { id: req.params.id as string },
        include: {
          research: true,
          packet: {
            select: { id: true, status: true, manuscriptVersionId: true },
          },
          invitations: {
            where: {
              inviteeId: req.user!.id,
              status: "ACCEPTED",
              role: { in: ["PANEL_CHAIR", "PANELIST"] },
            },
            select: { id: true },
          },
        },
      });
      if (!session || session.status !== "LIVE") {
        res.status(409).json({ error: "This defense session is not live." });
        return;
      }
      if (!session.invitations.length) {
        res
          .status(403)
          .json({ error: "A current accepted panel invitation is required." });
        return;
      }
      if (session.packet?.status !== "PUBLISHED") {
        res.status(409).json({
          error: "The official defense manuscript packet is not published.",
        });
        return;
      }

      const evaluationPacket = await prisma.defensePacket.findUnique({
        where: { defenseSessionId: session.id },
        select: { evaluationMode: true },
      });
      if (evaluationPacket?.evaluationMode === "PDF") {
        return void res.status(409).json({
          error:
            "This defense uses PDF evaluation. Open its PDF workspace to submit.",
        });
      }

      const templateId = String(req.body.templateId || "");
      const recommendation = String(
        req.body.recommendation || "",
      ).toUpperCase();
      const final = req.body.final === true;
      const remarks =
        typeof req.body.remarks === "string" ? req.body.remarks.trim() : "";
      const submittedScores = Array.isArray(req.body.criteriaScores)
        ? req.body.criteriaScores
        : [];
      const template = await prisma.evaluationTemplate.findUnique({
        where: { id: templateId },
        include: { criteria: { orderBy: { sequence: "asc" } } },
      });
      if (
        !template ||
        (template.researchTypeId &&
          template.researchTypeId !== session.research.researchTypeId)
      ) {
        res.status(400).json({
          error: "The selected rubric does not belong to this research type.",
        });
        return;
      }

      let normalizedScores: Array<Record<string, unknown>>;
      let totalScore: number;
      try {
        const normalized = normalizeEvaluationScores(
          template.criteria,
          submittedScores,
          final,
        );
        normalizedScores = normalized.criteriaScores;
        totalScore = normalized.totalScore;
      } catch (error) {
        if (error instanceof EvaluationScoreError) {
          return void res.status(400).json({ error: error.message });
        }
        throw error;
      }
      if (!RECOMMENDATIONS.has(recommendation)) {
        res.status(400).json({ error: "Select a valid recommendation." });
        return;
      }
      if (totalScore > Number(template.totalScore)) {
        res
          .status(400)
          .json({ error: "The calculated total exceeds the rubric maximum." });
        return;
      }

      const existing = await prisma.evaluation.findFirst({
        where: { defenseSessionId: session.id, evaluatorId: req.user!.id },
      });
      if (existing?.status === "LOCKED") {
        res.status(409).json({
          error: "Your final evaluation is locked and cannot be changed.",
          evaluation: existing,
        });
        return;
      }
      const lockedAt = final ? new Date() : null;
      const integrityPayload = final
        ? JSON.stringify({
            sessionId: session.id,
            researchId: session.researchId,
            evaluatorId: req.user!.id,
            templateId,
            totalScore,
            recommendation,
            normalizedScores,
            remarks,
            lockedAt: lockedAt!.toISOString(),
          })
        : null;
      const integrityHash = integrityPayload
        ? createHash("sha256").update(integrityPayload).digest("hex")
        : null;
      const data = {
        templateId,
        researchId: session.researchId,
        evaluatorId: req.user!.id,
        defenseSessionId: session.id,
        totalScore,
        recommendation: recommendation as any,
        criteriaScores: normalizedScores as any,
        remarks: remarks || null,
        status: final ? ("LOCKED" as const) : ("DRAFT" as const),
        submittedAt: final ? lockedAt : null,
        lockedAt,
        integrityHash,
      };
      const generatedVersion = final
        ? await defensePacketService.generateEvaluation(
            session.id,
            req.user!.id,
            data,
          )
        : null;
      const evaluation = existing
        ? await prisma.evaluation.update({ where: { id: existing.id }, data })
        : await prisma.evaluation.create({ data });
      res.json(
        jsonSafe({
          evaluation,
          generatedVersion,
          locked: final,
          calculatedTotal: totalScore,
        }),
      );
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to save the live evaluation.",
      });
    }
  },
);

router.post(
  "/defense-sessions/:id/badge",
  requireAuth,
  async (req: Request, res: Response) => {
    if (
      !req.user!.roles.includes("RESEARCH_COORDINATOR") ||
      !req.user!.collegeId
    ) {
      return void res
        .status(403)
        .json({
          error: "Only a research coordinator may issue defense badges.",
        });
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const session = await tx.defenseSession.findUnique({
          where: { id: req.params.id as string },
          include: {
            defenseEvent: true,
            research: {
              include: {
                members: {
                  where: {
                    leftAt: null,
                    projectRole: { in: ["LEADER", "MEMBER"] },
                  },
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        });
        // Match the coordinator's own college even for accounts with additional roles.
        if (!session || session.research.collegeId !== req.user!.collegeId) {
          return {
            status: 404,
            error: "Defense session was not found in your college scope.",
          };
        }
        if (!canIssueDefenseBadge(session)) {
          return {
            status: 409,
            error:
              "Badges require a released Approved result for a title or final defense. Pending revisions are not eligible.",
          };
        }
        if (!session.research.members.length) {
          return {
            status: 409,
            error: "The research group has no active student members.",
          };
        }
        const kind = defenseBadgeKind(session.defenseEvent?.defenseType)!;
        const inserted = await tx.defenseBadge.createMany({
          data: [
            {
              defenseSessionId: session.id,
              kind,
              issuedBy: req.user!.id,
              recipients: session.research.members.map((member) => ({
                userId: member.userId,
                name: `${member.user.firstName} ${member.user.lastName}`,
              })),
            },
          ],
          skipDuplicates: true,
        });
        const badge = await tx.defenseBadge.findUniqueOrThrow({
          where: { defenseSessionId: session.id },
          include: { issuer: { select: { firstName: true, lastName: true } } },
        });
        if (inserted.count) {
          await tx.auditLog.create({
            data: {
              userId: req.user!.id,
              action: "CREATE",
              entityType: "DefenseBadge",
              entityId: badge.id,
              newValues: {
                defenseSessionId: session.id,
                kind,
                issuedBy: req.user!.id,
              },
            },
          });
          await notifyResearchGroup(
            tx,
            session.researchId,
            "DEFENSE_CONFIRMED",
            "Defense badge issued",
            `Your coordinator issued your ${kind === "TITLE_DEFENSE" ? "Title" : "Final"} Defense Passed badge.`,
            session.id,
          );
        }
        return { status: inserted.count ? 201 : 200, badge };
      });
      res
        .status(result.status)
        .json(
          "error" in result ? { error: result.error } : { badge: result.badge },
        );
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to issue the defense badge." });
    }
  },
);

router.post(
  "/defense-sessions/:id/release",
  requireAuth,
  requireFacilitator,
  async (req: Request, res: Response) => {
    try {
      const decision = String(req.body.decision || "").toUpperCase();
      if (!DECISIONS.has(decision)) {
        res.status(400).json({ error: "Select a valid official decision." });
        return;
      }
      const revisionsRequired = [
        "APPROVED_WITH_MINOR_REVISIONS",
        "MAJOR_REVISIONS_REQUIRED",
      ].includes(decision);
      const revisionInstructions = String(
        req.body.revisionInstructions || "",
      ).trim();
      if (revisionsRequired && revisionInstructions.length < 10) {
        return void res.status(400).json({
          error:
            "Provide clear post-defense revision instructions (at least 10 characters).",
        });
      }
      const session = await prisma.defenseSession.findUnique({
        where: { id: req.params.id as string },
        include: {
          research: true,
          invitations: {
            where: {
              status: "ACCEPTED",
              role: { in: ["PANEL_CHAIR", "PANELIST"] },
              isRequired: true,
            },
          },
          evaluations: true,
          packet: {
            include: {
              manuscriptVersion: { include: { document: true } },
            },
          },
        },
      });
      if (!session || !["LIVE", "DELIBERATION"].includes(session.status)) {
        res.status(409).json({ error: "This session cannot be released." });
        return;
      }
      if (!canAccessCollege(req.user!, session.research.collegeId)) {
        res.status(404).json({
          error: "Defense session was not found in your college scope.",
        });
        return;
      }
      if (session.packet?.status !== "PUBLISHED") {
        return void res.status(409).json({
          error:
            "The official approved manuscript packet must be published before releasing a defense result.",
        });
      }
      const publishedPacket = session.packet;
      const pdfSubmissions =
        session.packet?.evaluationMode === "PDF"
          ? await prisma.pdfEvaluation.findMany({
              where: { defenseSessionId: session.id, status: "LOCKED" },
              select: { panelistId: true },
            })
          : [];
      const lockedEvaluatorIds = new Set(
        session.packet?.evaluationMode === "PDF"
          ? pdfSubmissions.map((item) => item.panelistId)
          : session.evaluations
              .filter((item) => item.status === "LOCKED")
              .map((item) => item.evaluatorId),
      );
      if (!session.invitations.length) {
        return void res.status(409).json({
          error: "The defense has no currently accepted required panelists.",
        });
      }
      const missing = session.invitations.filter(
        (invitation) => !lockedEvaluatorIds.has(invitation.inviteeId),
      );
      if (missing.length) {
        res.status(409).json({
          error: `Waiting for ${missing.length} panelist evaluation(s).`,
        });
        return;
      }
      const researchStatus =
        decision === "REJECTED"
          ? "REJECTED"
          : revisionsRequired
            ? "REVISION"
            : "APPROVED";
      const result = await prisma.$transaction(async (tx) => {
        await lockDefenseGroup(tx, session.researchId);
        const releasedAt = new Date();
        const released = await tx.defenseSession.updateMany({
          where: { id: session.id, status: { in: ["LIVE", "DELIBERATION"] } },
          data: {
            status: "COMPLETED",
            queueStatus: session.defenseEventId ? "COMPLETED" : undefined,
            decision: decision as any,
            endedAt: releasedAt,
            releasedAt,
            releasedBy: req.user!.id,
          },
        });
        if (!released.count) {
          const conflict = new Error(
            "This defense result was already released by another request.",
          ) as Error & { statusCode?: number };
          conflict.statusCode = 409;
          throw conflict;
        }
        await consumeDefenseEligibility(tx, session, decision, releasedAt);
        await tx.researchProject.update({
          where: { id: session.researchId },
          data: { status: researchStatus },
        });
        await notifyResearchGroup(
          tx,
          session.researchId,
          "DEFENSE_CONFIRMED",
          "Official defense result released",
          `The official defense decision for ${session.research.title} is ${decision
            .replace(/_/g, " ")
            .toLowerCase()}.`,
          session.id,
        );
        if (revisionsRequired) {
          const sourceVersion = publishedPacket.manuscriptVersion;
          const documentUpdated = await tx.document.updateMany({
            where: {
              id: sourceVersion.documentId,
              researchId: session.researchId,
              lifecycleStatus: { in: ["APPROVED", "FINALIZED"] },
            },
            data: { lifecycleStatus: "REVISION_REQUIRED" },
          });
          if (!documentUpdated.count) {
            const conflict = new Error(
              "The published manuscript is no longer in an approved state. Refresh before releasing the result.",
            ) as Error & { statusCode?: number };
            conflict.statusCode = 409;
            throw conflict;
          }
          await tx.manuscriptStatusEvent.create({
            data: {
              documentId: sourceVersion.documentId,
              versionId: sourceVersion.id,
              fromStatus: sourceVersion.document.lifecycleStatus,
              toStatus: "REVISION_REQUIRED",
              actorId: req.user!.id,
              reason: revisionInstructions,
              metadata: {
                defenseSessionId: session.id,
                defensePacketId: publishedPacket.id,
                sourceVersionId: sourceVersion.id,
                defenseDecision: decision,
                preservesPublishedPacket: true,
              },
            },
          });
          await tx.auditLog.create({
            data: {
              userId: req.user!.id,
              action: "CREATE",
              entityType: "DefenseManuscriptRevision",
              entityId: sourceVersion.id,
              newValues: {
                defenseSessionId: session.id,
                defensePacketId: publishedPacket.id,
                documentId: sourceVersion.documentId,
                sourceVersionId: sourceVersion.id,
                decision,
                revisionInstructions,
              },
              ipAddress: req.ip,
              userAgent: req.get("user-agent"),
            },
          });
          const recipients = await tx.researchProject.findUnique({
            where: { id: session.researchId },
            select: {
              members: {
                where: {
                  leftAt: null,
                  projectRole: { in: ["LEADER", "MEMBER", "ADVISER"] },
                },
                select: { userId: true },
              },
              workflowInstance: {
                select: { workflow: { select: { createdBy: true } } },
              },
            },
          });
          const recipientIds = new Set(
            recipients?.members.map(({ userId }) => userId) || [],
          );
          if (recipients?.workflowInstance?.workflow.createdBy)
            recipientIds.add(recipients.workflowInstance.workflow.createdBy);
          recipientIds.delete(req.user!.id);
          await createNotificationsOnce(
            tx,
            Array.from(recipientIds).map((recipientId) => ({
              recipientId,
              type: "REVISION_REQUESTED",
              title: "Post-defense manuscript revision requested",
              message: revisionInstructions,
              entityType: "DocumentVersion",
              entityId: sourceVersion.id,
              actionUrl: `/research/manuscript?projectId=${session.researchId}&documentId=${sourceVersion.documentId}&versionId=${sourceVersion.id}`,
              deduplicationKey: `defense:${session.id}:post-defense-revision:${recipientId}`,
            })),
          );
        }
        if (session.defenseEventId) {
          const remaining = await tx.defenseSession.count({
            where: {
              defenseEventId: session.defenseEventId,
              queueStatus: { notIn: ["COMPLETED", "SKIPPED"] },
              status: { not: "CANCELLED" },
            },
          });
          if (!remaining)
            await tx.defenseEvent.update({
              where: { id: session.defenseEventId },
              data: { status: "COMPLETED", completedAt: new Date() },
            });
        }
        return tx.defenseSession.findUniqueOrThrow({
          where: { id: session.id },
          include: sessionInclude,
        });
      });
      res.json({ session: result });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error:
          error.message || "Failed to release the official defense result.",
      });
    }
  },
);

router.get(
  "/defense-sessions/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const session = await prisma.defenseSession.findUnique({
        where: { id: req.params.id as string },
        include: sessionInclude,
      });
      if (!session) {
        res.status(404).json({ error: "Defense session was not found." });
        return;
      }
      const userInvitation = session.invitations.find(
        (invitation) => invitation.inviteeId === req.user!.id,
      );
      const crossCollegePanelInvitation = currentPanelInvitation(
        session.invitations,
        req.user!.id,
      );
      const inCollegeScope = canAccessCollege(
        req.user!,
        session.research.collegeId,
      );
      if (!inCollegeScope && !crossCollegePanelInvitation) {
        res.status(404).json({
          error: "Defense session was not found in your college scope.",
        });
        return;
      }
      const isInstitutionWide =
        getCollegeScope(req.user!).kind === "institution";
      const isFacilitator =
        inCollegeScope && hasDefenseFacilitatorAccess(req.user!);
      const isMember = session.research.members.some(
        (member) => member.userId === req.user!.id,
      );
      const isInvited = Boolean(
        userInvitation && userInvitation.status !== "REMOVED",
      );
      if (!isInstitutionWide && !isFacilitator && !isMember && !isInvited) {
        res.status(404).json({ error: "Defense session was not found." });
        return;
      }
      if (req.user!.roles.includes("RESEARCHER") && isMember) {
        session.evaluations = [];
        session.pdfEvaluations = [];
      } else if (!isInstitutionWide && !isFacilitator && isInvited) {
        return void res.json({
          session: scopeSessionForPanelist(session, req.user!.id),
        });
      }
      res.json({ session });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to load the defense session.",
      });
    }
  },
);

router.get(
  "/research/:researchId/defense-result",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const researchId = req.params.researchId as string;
      const research = await prisma.researchProject.findUnique({
        where: { id: researchId },
        select: { collegeId: true },
      });
      if (!research || !canAccessCollege(req.user!, research.collegeId)) {
        res.status(404).json({
          error: "Defense result was not found in your college scope.",
        });
        return;
      }
      const isResearcher = req.user!.roles.includes("RESEARCHER");
      if (isResearcher) {
        const membership = await prisma.researchMember.findFirst({
          where: {
            researchId,
            userId: req.user!.id,
            projectRole: { in: ["LEADER", "MEMBER"] },
            leftAt: null,
          },
        });
        if (!membership) {
          res
            .status(403)
            .json({ error: "You do not have access to this defense result." });
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
      res.status(500).json({
        error: error.message || "Failed to load the official defense result.",
      });
    }
  },
);

export default router;
