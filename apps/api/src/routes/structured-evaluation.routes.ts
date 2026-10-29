import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { structuredFormSchema } from "@research-management/validations";
import { prisma } from "../lib/prisma.js";
import {
  appendEvaluationEvent,
  loadEvaluationIntegrity,
  assertEvaluationIntegrity,
  submissionPayload,
  checkpointSchema,
} from "../services/evaluation-ledger.service.js";
import { validateEvaluationLogos } from "../services/structured-evaluation-pdf.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCollege } from "../lib/college-scope.js";
import {
  defenseManuscriptService,
  hasDefenseFacilitatorAccess,
} from "../services/defense-manuscript.service.js";
import {
  lockDefenseGroup,
  consumeDefenseEligibility,
} from "../services/defense-eligibility.service.js";
import {
  StructuredEvaluationError as Conflict,
  readForm,
  scoreStructuredEvaluation,
  consolidatedScores,
  renderStructuredEvaluation,
  evaluationPdfHash,
  type FormSnapshot,
} from "../services/structured-evaluation.service.js";

const router = Router();
const run =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      res.status(e instanceof z.ZodError ? 400 : e.statusCode || 500).json({
        error:
          e instanceof z.ZodError
            ? e.issues[0]?.message
            : e.message || "Unable to save the evaluation.",
      });
    }
  };
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Db = Prisma.TransactionClient | typeof prisma;
async function access(req: Request, db: Db = prisma) {
  const session = await db.defenseSession.findUnique({
    where: { id: z.string().uuid().parse(req.params.id) },
    include: {
      packet: true,
      invitations: {
        include: { invitee: { select: { firstName: true, lastName: true } } },
      },
      research: {
        include: {
          college: { select: { name: true } },
          members: {
            where: { leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } },
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
      structuredEvaluations: { select: { panelistId: true, lockedAt: true } },
    },
  });
  if (!session) throw new Conflict("Defense session not found.", 404);
  const facilitator =
    hasDefenseFacilitatorAccess(req.user!) &&
    canAccessCollege(req.user!, session.research.collegeId);
  const accepted =
    req.user!.roles.includes("PANELIST") &&
    session.invitations.some(
      (i) =>
        i.inviteeId === req.user!.id &&
        i.status === "ACCEPTED" &&
        ["PANELIST", "PANEL_CHAIR"].includes(i.role),
    );
  const researcher = session.research.members.some(
    (m) => m.userId === req.user!.id,
  );
  if (!facilitator && !accepted && !researcher)
    throw new Conflict("Defense session not found.", 404);
  return { session, facilitator, accepted, researcher };
}
async function lockedAccess(req: Request, tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT id FROM defense_sessions WHERE id = ${z.string().uuid().parse(req.params.id)}::uuid FOR UPDATE`;
  return access(req, tx);
}
const key = (id: string, userId: string) => ({
  defenseSessionId_panelistId: { defenseSessionId: id, panelistId: userId },
});
const metadata = (e: any) =>
  e
    ? {
        id: e.id,
        revision: e.revision,
        answers: e.answers,
        totals: e.totals,
        lockedAt: e.lockedAt,
        previewHash: e.previewHash,
      }
    : null;
function formFor(a: Awaited<ReturnType<typeof access>>) {
  if (
    a.session.packet?.evaluationMode !== "STRUCTURED" ||
    a.session.packet.status !== "PUBLISHED"
  )
    throw new Conflict("Publish the structured evaluation packet first.");
  return readForm(a.session.packet.structuredForm);
}
function canEdit(a: Awaited<ReturnType<typeof access>>) {
  if (!a.accepted)
    throw new Conflict("An accepted panel assignment is required.", 403);
  if (a.session.status !== "LIVE")
    throw new Conflict(
      "Evaluation editing is available only during the live defense.",
    );
}
router.get(
  "/structured-evaluation-templates",
  requireAuth,
  run(async (req, res) => {
    if (!hasDefenseFacilitatorAccess(req.user!))
      throw new Conflict("Defense facilitator access is required.", 403);
    res.json({
      templates: await prisma.structuredEvaluationTemplate.findMany({
        where: { collegeId: req.user!.collegeId! },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    });
  }),
);
router.post(
  "/structured-evaluation-templates",
  requireAuth,
  run(async (req, res) => {
    if (!hasDefenseFacilitatorAccess(req.user!))
      throw new Conflict("Defense facilitator access is required.", 403);
    const spec = structuredFormSchema.parse(req.body.spec);
    await validateEvaluationLogos(spec);
    const template = await prisma.structuredEvaluationTemplate.create({
      data: {
        collegeId: req.user!.collegeId!,
        createdBy: req.user!.id,
        spec: json(spec),
      },
    });
    res.status(201).json({ template });
  }),
);
router.get(
  "/defense-sessions/:id/structured-form",
  requireAuth,
  run(async (req, res) => {
    const a = await access(req);
    if (!a.facilitator && !a.accepted)
      throw new Conflict(
        "Evaluation materials are not available to this account.",
        403,
      );
    if (!a.facilitator && a.session.packet?.status !== "PUBLISHED")
      throw new Conflict("The packet is not published.");
    const readiness = a.facilitator
      ? await defenseManuscriptService.getReadiness(a.session.id)
      : null;
    const eligibility = a.session.eligibilityId
      ? await prisma.defenseEligibility.findUnique({
          where: { id: a.session.eligibilityId },
          select: { milestoneId: true },
        })
      : null;
    const candidates =
      readiness?.eligibleVersions.filter(
        (v) => v.milestoneId === eligibility?.milestoneId,
      ) || [];
    const similarityReport = a.session.packet?.similarityReportVersionId
      ? await prisma.documentVersion.findUnique({
          where: { id: a.session.packet.similarityReportVersionId },
          select: { id: true, fileName: true },
        })
      : null;
    res.json({
      snapshot: a.session.packet?.structuredForm || null,
      collegeName: a.session.research.college?.name || "",
      similarityReport,
      packetStatus: a.session.packet?.status || null,
      mappingVersion: a.session.packet?.mappingVersion || 0,
      manuscriptVersionId: a.session.packet?.manuscriptVersionId || null,
      candidates,
      roster: a.session.research.members.map((m) => ({
        userId: m.userId,
        name: `${m.user.firstName} ${m.user.lastName}`,
      })),
      sessionStatus: a.session.status,
    });
  }),
);
router.put(
  "/defense-sessions/:id/structured-form",
  requireAuth,
  run(async (req, res) => {
    const spec = structuredFormSchema.parse(req.body.spec),
      publish = req.body.publish === true;
    const initial = await access(req);
    if (!initial.facilitator)
      throw new Conflict("Defense facilitator access is required.", 403);
    await validateEvaluationLogos(spec);
    const readiness = await defenseManuscriptService.getReadiness(
      initial.session.id,
    );
    const eligibility = initial.session.eligibilityId
      ? await prisma.defenseEligibility.findUnique({
          where: { id: initial.session.eligibilityId },
        })
      : null;
    if (!eligibility)
      throw new Conflict(
        "This session needs a linked Defense Eligibility milestone to use the new form.",
      );
    const candidates =
      readiness?.eligibleVersions.filter(
        (v) => v.milestoneId === eligibility.milestoneId,
      ) || [];
    const manuscriptId = String(
      req.body.manuscriptVersionId ||
        (candidates.length === 1 ? candidates[0].id : ""),
    );
    if (!candidates.some((v) => v.id === manuscriptId))
      throw new Conflict(
        "Select an approved manuscript submitted for this session’s Defense Eligibility milestone.",
      );
    await prisma.$transaction(async (tx) => {
      const a = await lockedAccess(req, tx),
        s = a.session;
      if (!a.facilitator)
        throw new Conflict("Defense facilitator access is required.", 403);
      if (
        ![
          "SCHEDULED",
          "PENDING_ACKNOWLEDGEMENT",
          "NEEDS_RESCHEDULING",
        ].includes(s.status) ||
        s.startedAt
      )
        throw new Conflict(
          "Evaluation materials are fixed once the defense starts.",
        );
      if (
        s.packet &&
        Number(req.body.expectedMappingVersion) !== s.packet.mappingVersion
      )
        throw new Conflict(
          "The packet changed in another tab. Reload before saving.",
        );
      if (
        s.packet?.status === "PUBLISHED" &&
        (!publish ||
          String(req.body.publicationReason || "").trim().length < 10)
      )
        throw new Conflict(
          "Provide a reason of at least 10 characters to replace published materials.",
        );
      if (
        await tx.structuredEvaluation.count({
          where: { defenseSessionId: s.id },
        })
      )
        throw new Conflict(
          "The form cannot change after a panelist has saved an evaluation.",
        );
      if (s.packet && s.packet.evaluationMode !== "STRUCTURED")
        throw new Conflict(
          "Existing legacy packets retain their original evaluation mode.",
        );
      if (s.evaluationLedgerStartedAt) {
        const { verification } = await loadEvaluationIntegrity(tx, s.id);
        assertEvaluationIntegrity(verification);
      }
      const verified = await defenseManuscriptService.getReadiness(
        s.id,
        manuscriptId,
        tx,
      );
      if (
        !verified?.eligibleVersions.some(
          (v) =>
            v.id === manuscriptId && v.milestoneId === eligibility.milestoneId,
        )
      )
        throw new Conflict(
          "The approved manuscript or panel readiness changed. Refresh before publishing.",
        );
      const roster = s.research.members.map((m) => ({
        userId: m.userId,
        name: `${m.user.firstName} ${m.user.lastName}`,
      }));
      const panelists = s.invitations
        .filter(
          (i) =>
            i.status !== "REMOVED" &&
            ["PANEL_CHAIR", "PANELIST"].includes(i.role),
        )
        .map((i) => ({
          userId: i.inviteeId,
          name: `${i.invitee.firstName} ${i.invitee.lastName}`,
          required: i.isRequired,
        }));
      if (
        !roster.length ||
        (publish &&
          !s.invitations.some(
            (i) =>
              i.status === "ACCEPTED" &&
              i.isRequired &&
              ["PANEL_CHAIR", "PANELIST"].includes(i.role),
          ))
      )
        throw new Conflict(
          "An active researcher and accepted required panelists are needed.",
        );
      const snapshot: FormSnapshot = {
        spec,
        roster,
        panelists,
        researchTitle: s.research.title,
        manuscriptVersionId: manuscriptId,
        publishedAt: publish ? new Date().toISOString() : null,
      };
      const data = {
        manuscriptVersionId: manuscriptId,
        similarityReportVersionId: req.body.similarityReportVersionId
          ? z.string().uuid().parse(req.body.similarityReportVersionId)
          : null,
        structuredForm: json(snapshot),
        evaluationMode: "STRUCTURED",
        publishedById: req.user!.id,
        status: publish ? ("PUBLISHED" as const) : ("DRAFT" as const),
        publishedAt: publish ? new Date() : null,
        mappingVersion: (s.packet?.mappingVersion || 0) + 1,
      };
      if (data.similarityReportVersionId) {
        const supporting = await tx.documentVersion.findFirst({
          where: {
            id: data.similarityReportVersionId,
            mimeType: "application/pdf",
            status: "ACTIVE",
            document: {
              researchId: s.researchId,
              documentType: "SIMILARITY_REPORT",
            },
          },
          select: { id: true },
        });
        if (!supporting)
          throw new Conflict(
            "Select a similarity report belonging to this research project.",
            400,
          );
      }
      const packet = await tx.defensePacket.upsert({
        where: { defenseSessionId: s.id },
        create: { defenseSessionId: s.id, ...data },
        update: data,
      });
      if (publish) {
        if (!s.evaluationLedgerStartedAt)
          await tx.defenseSession.update({
            where: { id: s.id },
            data: { evaluationLedgerStartedAt: new Date() },
          });
        await appendEvaluationEvent(tx, {
          sessionId: s.id,
          eventType: "FORM_PUBLISHED",
          actorId: req.user!.id,
          actorRoles: req.user!.roles,
          operationId: `form:${s.id}:${data.mappingVersion}`,
          payload: {
            snapshot,
            mappingVersion: data.mappingVersion,
            publicationReason:
              String(req.body.publicationReason || "").trim() || null,
          },
        });
      }
      if (publish)
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "PUBLISH",
            entityType: "DefensePacketPublication",
            entityId: packet.id,
            oldValues: s.packet?.structuredForm || Prisma.JsonNull,
            newValues: json({
              snapshot,
              publicationReason: req.body.publicationReason || null,
              mappingVersion: data.mappingVersion,
            }),
          },
        });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "UPDATE",
          entityType: "DefensePacket",
          entityId: s.id,
          newValues: {
            publish,
            manuscriptId,
            reason: req.body.publicationReason || null,
            mappingVersion: data.mappingVersion,
          },
        },
      });
      if (publish)
        await tx.notification.createMany({
          data: panelists
            .filter((p) =>
              s.invitations.some(
                (i) => i.inviteeId === p.userId && i.status === "ACCEPTED",
              ),
            )
            .map((p) => ({
              recipientId: p.userId,
              audience: "panelist",
              type: "DEFENSE_CONFIRMED" as const,
              title: "Defense review packet published",
              message: `The approved manuscript and digital evaluation form for ${s.research.title} are ready.`,
              entityType: "DefenseSession",
              entityId: s.id,
            })),
        });
    });
    res.json({ saved: true });
  }),
);
router.get(
  "/defense-sessions/:id/structured-evaluation",
  requireAuth,
  run(async (req, res) => {
    const a = await access(req);
    if (!a.accepted)
      throw new Conflict("An accepted panel assignment is required.", 403);
    const snapshot = formFor(a);
    if (!snapshot.panelists.some((p) => p.userId === req.user!.id))
      throw new Conflict(
        "Your assignment is outside the published panel roster.",
        403,
      );
    const item = await prisma.structuredEvaluation.findUnique({
      where: key(a.session.id, req.user!.id),
    });
    const ledgerEntry =
      a.session.evaluationLedgerStartedAt && item?.lockedAt
        ? await prisma.evaluationLedgerEvent.findUnique({
            where: { operationId: `evaluation:${item.id}:${item.revision}` },
          })
        : null;
    res.json({
      snapshot,
      evaluation: metadata(item),
      receipt: ledgerEntry
        ? {
            sequence: ledgerEntry.sequence,
            eventHash: ledgerEntry.eventHash,
            recordedAt: ledgerEntry.occurredAt,
          }
        : null,
      sessionStatus: a.session.status,
    });
  }),
);
router.put(
  "/defense-sessions/:id/structured-evaluation",
  requireAuth,
  run(async (req, res) => {
    const revision = z.number().int().nonnegative().parse(req.body.revision);
    const saved = await prisma.$transaction(async (tx) => {
      const a = await lockedAccess(req, tx);
      canEdit(a);
      const snapshot = formFor(a);
      if (!snapshot.panelists.some((p) => p.userId === req.user!.id))
        throw new Conflict(
          "Your assignment is outside the published panel roster.",
          403,
        );
      const existing = await tx.structuredEvaluation.findUnique({
        where: key(a.session.id, req.user!.id),
      });
      if (existing?.lockedAt)
        throw new Conflict("Your final evaluation is locked.");
      if ((existing?.revision || 0) !== revision)
        throw new Conflict(
          "This draft changed in another tab. Reload it before editing.",
        );
      const scored = scoreStructuredEvaluation(
        snapshot,
        req.body.answers,
        false,
      );
      const data = {
        answers: json(scored.answers),
        totals: json(scored.totals),
        revision: revision + 1,
        previewHash: null,
        pdfData: null,
      };
      return tx.structuredEvaluation.upsert({
        where: key(a.session.id, req.user!.id),
        create: {
          defenseSessionId: a.session.id,
          panelistId: req.user!.id,
          ...data,
        },
        update: data,
      });
    });
    res.json({ evaluation: metadata(saved) });
  }),
);
router.post(
  "/defense-sessions/:id/structured-evaluation/preview",
  requireAuth,
  run(async (req, res) => {
    const revision = z.number().int().positive().parse(req.body.revision);
    const item = await prisma.$transaction(
      async (tx) => {
        const a = await lockedAccess(req, tx);
        canEdit(a);
        const snapshot = formFor(a);
        const e = await tx.structuredEvaluation.findUnique({
          where: key(a.session.id, req.user!.id),
        });
        if (!e || e.lockedAt || e.revision !== revision)
          throw new Conflict(
            "Save the current evaluation draft before previewing.",
          );
        const { answers } = scoreStructuredEvaluation(
            snapshot,
            e.answers,
            true,
          ),
          panel = snapshot.panelists.find((p) => p.userId === req.user!.id);
        if (!panel)
          throw new Conflict(
            "Your panel assignment is not in the published roster.",
            403,
          );
        if (
          snapshot.spec.signatureRequired &&
          answers.signature.trim().toLocaleLowerCase() !==
            panel.name.trim().toLocaleLowerCase()
        )
          throw new Conflict(`Sign using your full name: ${panel.name}.`, 400);
        const buffer = await renderStructuredEvaluation(
          snapshot,
          answers,
          panel.name,
        );
        return tx.structuredEvaluation.update({
          where: { id: e.id },
          data: {
            pdfData: Uint8Array.from(buffer),
            previewHash: evaluationPdfHash(buffer),
          },
        });
      },
      { timeout: 20000 },
    );
    res.json({ evaluation: metadata(item) });
  }),
);
router.post(
  "/defense-sessions/:id/structured-evaluation/submit",
  requireAuth,
  run(async (req, res) => {
    const input = z
      .object({
        revision: z.number().int().positive(),
        previewHash: z.string().length(64),
        confirmed: z.literal(true),
      })
      .parse(req.body);
    const item = await prisma.$transaction(async (tx) => {
      const a = await lockedAccess(req, tx);
      canEdit(a);
      const snapshot = formFor(a);
      const e = await tx.structuredEvaluation.findUnique({
        where: key(a.session.id, req.user!.id),
      });
      if (!e) throw new Conflict("Save and preview your evaluation first.");
      if (a.session.evaluationLedgerStartedAt) {
        const { verification } = await loadEvaluationIntegrity(
          tx,
          a.session.id,
        );
        assertEvaluationIntegrity(verification);
      }
      if (e.lockedAt) {
        if (
          e.previewHash === input.previewHash &&
          e.revision === input.revision
        )
          return e;
        throw new Conflict("Your final evaluation is locked.");
      }
      scoreStructuredEvaluation(snapshot, e.answers, true);
      if (
        e.revision !== input.revision ||
        e.previewHash !== input.previewHash ||
        !e.pdfData ||
        evaluationPdfHash(e.pdfData) !== input.previewHash
      )
        throw new Conflict("Preview the current draft before submitting.");
      const saved = await tx.structuredEvaluation.update({
        where: { id: e.id },
        data: { lockedAt: new Date() },
      });
      if (a.session.evaluationLedgerStartedAt)
        await appendEvaluationEvent(tx, {
          sessionId: a.session.id,
          eventType: "EVALUATION_SUBMITTED",
          actorId: req.user!.id,
          actorRoles: req.user!.roles,
          operationId: `evaluation:${e.id}:${e.revision}`,
          payload: submissionPayload(saved),
        });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "CREATE",
          entityType: "StructuredEvaluationSubmission",
          entityId: e.id,
          newValues: { revision: e.revision, integrityHash: e.previewHash },
        },
      });
      return saved;
    });
    res.json({ evaluation: metadata(item) });
  }),
);
router.get(
  "/defense-sessions/:id/structured-evaluations/:panelistId/pdf",
  requireAuth,
  run(async (req, res) => {
    const a = await access(req),
      panelistId = z.string().uuid().parse(req.params.panelistId);
    if (!a.facilitator && (!a.accepted || req.user!.id !== panelistId))
      throw new Conflict("This evaluation is private.", 403);
    const item = await prisma.structuredEvaluation.findUnique({
      where: key(a.session.id, panelistId),
    });
    if (
      !item?.pdfData ||
      (!item.lockedAt && (!a.accepted || panelistId !== req.user!.id))
    )
      throw new Conflict("The evaluation PDF is not available.", 404);
    res.setHeader("Cache-Control", "private, no-store");
    res.type("application/pdf").send(Buffer.from(item.pdfData));
  }),
);
// Consistent snapshot: never verify an old head against a newly committed submission.
const integrityHandler = run(async (req, res) => {
  const checkpoint =
    req.method === "POST"
      ? checkpointSchema.parse(req.body.checkpoint)
      : undefined;
  const result = await prisma.$transaction(
    async (tx) => {
      const a = await access(req, tx);
      if (!a.facilitator && (!a.researcher || !a.session.releasedAt))
        throw new Conflict(
          "Integrity reports are available to facilitators and to researchers after result release.",
          403,
        );
      const { verification, events } = await loadEvaluationIntegrity(
        tx,
        a.session.id,
        checkpoint,
      );
      return {
        ...verification,
        // Raw payloads contain private evaluations and are never returned here.
        issues: a.facilitator
          ? verification.issues
          : verification.issues.length
            ? ["Evaluation integrity requires facilitator review."]
            : [],
        history: a.facilitator
          ? events.map((e) => ({
              sequence: e.sequence,
              eventType: e.eventType,
              occurredAt: e.occurredAt,
              eventHash: e.eventHash,
            }))
          : [],
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  res.setHeader("Cache-Control", "private, no-store");
  res.json(result);
});
router.get(
  "/defense-sessions/:id/evaluation-integrity",
  requireAuth,
  integrityHandler,
);
router.post(
  "/defense-sessions/:id/evaluation-integrity",
  requireAuth,
  integrityHandler,
);

router.get(
  "/defense-sessions/:id/structured-results",
  requireAuth,
  run(async (req, res) => {
    const a = await access(req),
      snapshot = formFor(a);
    if (!a.facilitator && (!a.researcher || !a.session.releasedAt))
      throw new Conflict(
        "Consolidated results are available to facilitators and to researchers after release.",
        403,
      );
    const submissions = await prisma.structuredEvaluation.findMany({
      where: { defenseSessionId: a.session.id },
      select: { panelistId: true, lockedAt: true, answers: true },
    });
    const report = consolidatedScores(snapshot, submissions);
    const source = await prisma.documentVersion.findUnique({
      where: { id: a.session.packet!.manuscriptVersionId },
      select: { documentId: true, versionNumber: true },
    });
    const clearanceCandidates =
      a.facilitator && source
        ? await prisma.documentVersion.findMany({
            where: {
              documentId: source.documentId,
              versionNumber: { gt: source.versionNumber },
              isImmutable: true,
              manuscriptStatus: { in: ["APPROVED", "FINALIZED"] },
            },
            select: { id: true, fileName: true, versionNumber: true },
            orderBy: { versionNumber: "desc" },
          })
        : [];
    res.json({
      snapshot,
      report,
      decision: a.session.decision,
      releasedAt: a.session.releasedAt,
      revisionClearance: a.session.revisionClearance,
      clearanceCandidates,
    });
  }),
);
router.post(
  "/defense-sessions/:id/revision-clearance",
  requireAuth,
  run(async (req, res) => {
    const input = z
      .object({
        versionId: z.string().uuid(),
        notes: z.string().trim().min(10).max(5000),
      })
      .parse(req.body);
    await prisma.$transaction(async (tx) => {
      const a = await access(req, tx);
      if (!a.facilitator)
        throw new Conflict("Defense facilitator access is required.", 403);
      await lockDefenseGroup(tx, a.session.researchId);
      const current = await tx.defenseSession.findUniqueOrThrow({
        where: { id: a.session.id },
      });
      if (current.revisionClearance)
        throw new Conflict("Revisions have already been cleared.");
      if (
        !current.releasedAt ||
        !["APPROVED_WITH_MINOR_REVISIONS", "MAJOR_REVISIONS_REQUIRED"].includes(
          current.decision || "",
        )
      )
        throw new Conflict(
          "Only a released revision result can be cleared without another defense.",
        );
      if (
        await tx.defenseSession.count({
          where: {
            researchId: current.researchId,
            id: { not: current.id },
            status: {
              in: [
                "LIVE",
                "DELIBERATION",
                "SCHEDULED",
                "PENDING_ACKNOWLEDGEMENT",
                "NEEDS_RESCHEDULING",
              ],
            },
          },
        })
      )
        throw new Conflict(
          "Resolve the group’s active defense session before clearing revisions.",
        );
      const original = await tx.documentVersion.findUniqueOrThrow({
        where: { id: a.session.packet!.manuscriptVersionId },
      });
      const version = await tx.documentVersion.findUnique({
        where: { id: input.versionId },
        include: {
          document: true,
          reviewerAssignments: {
            where: {
              isRequired: true,
              status: { in: ["ACTIVE", "COMPLETED"] },
            },
            include: { review: true },
          },
        },
      });
      if (
        !version ||
        version.documentId !== original.documentId ||
        version.versionNumber <= original.versionNumber ||
        !version.isImmutable ||
        version.document.currentVersion !== version.versionNumber ||
        !["APPROVED", "FINALIZED"].includes(String(version.manuscriptStatus)) ||
        !["APPROVED", "FINALIZED"].includes(version.document.lifecycleStatus) ||
        !version.reviewerAssignments.length ||
        version.reviewerAssignments.some(
          (r) =>
            r.status !== "COMPLETED" ||
            r.review?.recommendation !== "APPROVE" ||
            !r.review.submittedAt,
        )
      )
        throw new Conflict(
          "Select the newer approved manuscript with completed exact-version faculty reviews.",
        );
      const clearance = {
        versionId: version.id,
        notes: input.notes,
        clearedBy: req.user!.id,
        clearedAt: new Date().toISOString(),
      };
      await consumeDefenseEligibility(tx, current, "APPROVED", new Date());
      await tx.defenseSession.update({
        where: { id: current.id },
        data: { revisionClearance: clearance },
      });
      await tx.researchProject.update({
        where: { id: current.researchId },
        data: { status: "APPROVED" },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "APPROVE",
          entityType: "DefenseRevisionClearance",
          entityId: current.id,
          newValues: clearance,
        },
      });
      await tx.notification.createMany({
        data: a.session.research.members.map((m) => ({
          recipientId: m.userId,
          audience: "researcher",
          type: "DEFENSE_CONFIRMED" as const,
          title: "Post-defense revisions cleared",
          message: input.notes,
          entityType: "DefenseSession",
          entityId: current.id,
        })),
      });
    });
    res.json({ cleared: true });
  }),
);
export default router;
