import { Router } from "express";
import { z } from "zod";
import { prisma, Prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { recordAudit } from "../services/audit.service.js";
import { auditCategories, safeAuditValue } from "../services/audit-contract.js";
import { securityAuditHealth } from "../services/security-audit.service.js";

const router = Router();
const uuid = z.string().uuid();
const filters = z
  .object({
    category: z.enum(auditCategories).optional(),
    action: z
      .enum([
        "CREATE",
        "UPDATE",
        "DELETE",
        "APPROVE",
        "REJECT",
        "TRANSITION",
        "PUBLISH",
        "LOGIN",
        "LOGOUT",
        "ROLE_CHANGE",
        "PERMISSION_CHANGE",
        "SIGN",
        "DOWNLOAD",
      ])
      .optional(),
    outcome: z.enum(["SUCCESS", "FAILURE", "UNKNOWN"]).optional(),
    actorId: uuid.optional(),
    researchId: uuid.optional(),
    entityId: uuid.optional(),
    eventType: z
      .string()
      .max(100)
      .regex(/^[\w.:-]+$/)
      .optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    cursor: z.string().max(300).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export function auditWhere(query: unknown, now = new Date()) {
  const input = filters.parse(query);
  const to = input.to ? new Date(input.to) : now;
  const from = input.from
    ? new Date(input.from)
    : new Date(to.getTime() - 30 * 86400000);
  if (to < from || to.getTime() - from.getTime() > 366 * 86400000)
    throw new Error("Choose a date range of at most 366 days.");
  const where: Prisma.AuditLogWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(input.category && { category: input.category }),
    ...(input.action && { action: input.action }),
    ...(input.outcome && { outcome: input.outcome }),
    ...(input.actorId && { userId: input.actorId }),
    ...(input.researchId && { researchId: input.researchId }),
    ...(input.entityId && { entityId: input.entityId }),
    ...(input.eventType && { eventType: input.eventType }),
  };
  if (input.cursor) {
    const cursor = z
      .object({
        at: z.string().datetime(),
        id: uuid,
        to: z.string().datetime(),
      })
      .strict()
      .parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString()));
    const cursorTo = new Date(cursor.to);
    if (
      input.from &&
      (cursorTo < from || cursorTo.getTime() - from.getTime() > 366 * 86400000)
    )
      throw new Error("Cursor exceeds the date range.");
    if (input.to && cursorTo.getTime() !== to.getTime())
      throw new Error("Cursor does not match the date range.");
    // Keep the original upper bound throughout pagination, including the default range.
    where.createdAt = {
      gte: input.from ? from : new Date(cursorTo.getTime() - 30 * 86400000),
      lte: cursorTo,
    };
    where.OR = [
      { createdAt: { lt: new Date(cursor.at) } },
      { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
    ];
    return { where, limit: input.limit, to: cursorTo };
  }
  return { where, limit: input.limit, to };
}
const summarySelect = {
  id: true,
  createdAt: true,
  actorReference: true,
  actorRoles: true,
  action: true,
  entityType: true,
  entityId: true,
  eventType: true,
  category: true,
  outcome: true,
  contractVersion: true,
  researchId: true,
  summaryCount: true,
  firstOccurredAt: true,
  lastOccurredAt: true,
} satisfies Prisma.AuditLogSelect;
function badQuery(res: import("express").Response) {
  res.status(400).json({
    error:
      "Invalid audit query. Use valid filters and a date range of at most 366 days.",
  });
}

router.get(
  "/admin/audit",
  requireAuth,
  requireRole("SYSTEM_ADMIN"),
  async (req, res) => {
    let parsed: ReturnType<typeof auditWhere>;
    try {
      parsed = auditWhere(req.query);
    } catch {
      badQuery(res);
      return;
    }
    try {
      const rows = await prisma.auditLog.findMany({
        where: parsed.where,
        select: summarySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: parsed.limit + 1,
      });
      const hasMore = rows.length > parsed.limit;
      const events = rows.slice(0, parsed.limit);
      const last = events.at(-1);
      res.set("Cache-Control", "no-store").json({
        events,
        nextCursor:
          hasMore && last
            ? Buffer.from(
                JSON.stringify({
                  at: last.createdAt.toISOString(),
                  id: last.id,
                  to: parsed.to.toISOString(),
                }),
              ).toString("base64url")
            : null,
        security: {
          ...securityAuditHealth,
          configured: Boolean(process.env.AUDIT_REDIS_URL),
        },
      });
    } catch {
      res
        .status(503)
        .json({ error: "Audit history is temporarily unavailable." });
    }
  },
);

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
const exportsByActor = new Map<string, number>();
router.get(
  "/admin/audit/export",
  requireAuth,
  requireRole("SYSTEM_ADMIN"),
  async (req, res) => {
    let parsed: ReturnType<typeof auditWhere>;
    try {
      parsed = auditWhere(req.query);
    } catch {
      badQuery(res);
      return;
    }
    const now = Date.now();
    for (const [actor, until] of exportsByActor)
      if (until <= now) exportsByActor.delete(actor);
    if (exportsByActor.has(req.user!.id) || exportsByActor.size >= 1000) {
      res
        .set("Retry-After", "60")
        .status(429)
        .json({ error: "Wait one minute before exporting again." });
      return;
    }
    exportsByActor.set(req.user!.id, now + 60_000);
    try {
      const rows = await prisma.auditLog.findMany({
        where: parsed.where,
        select: summarySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1001,
      });
      if (rows.length > 1000) {
        res
          .status(413)
          .json({ error: "Export exceeds 1,000 events. Narrow the filters." });
        return;
      }
      await recordAudit(prisma, {
        userId: req.user!.id,
        actorRoles: req.user!.roles,
        action: "DOWNLOAD",
        entityType: "AuditExport",
        category: "SECURITY",
        newValues: { count: rows.length, requestedFilters: req.query },
      });
      const keys = Object.keys(summarySelect);
      const csv = [
        keys.map(csvCell).join(","),
        ...rows.map((row) =>
          keys
            .map((key) => {
              const value = row[key as keyof typeof row];
              return csvCell(
                value instanceof Date
                  ? value.toISOString()
                  : Array.isArray(value)
                    ? value.join("; ")
                    : value,
              );
            })
            .join(","),
        ),
      ].join("\r\n");
      res
        .set({
          "Cache-Control": "no-store",
          "Content-Disposition": 'attachment; filename="advisio-audit.csv"',
          "Content-Type": "text/csv; charset=utf-8",
        })
        .send(csv);
    } catch {
      res
        .status(503)
        .json({ error: "Audit export is temporarily unavailable." });
    }
  },
);

router.get(
  "/admin/audit/:id",
  requireAuth,
  requireRole("SYSTEM_ADMIN"),
  async (req, res) => {
    if (!uuid.safeParse(req.params.id).success) {
      res.status(400).json({ error: "Invalid event ID." });
      return;
    }
    try {
      const event = await prisma.auditLog.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!event) {
        res.status(404).json({ error: "Audit event not found." });
        return;
      }
      // Legacy rows may contain fields that predate the new write-time sanitizer.
      res.set("Cache-Control", "no-store").json({
        event: {
          ...event,
          oldValues: safeAuditValue(event.oldValues),
          newValues: safeAuditValue(event.newValues),
        },
      });
    } catch {
      res
        .status(503)
        .json({ error: "Audit event is temporarily unavailable." });
    }
  },
);

router.get("/research/:researchId/audit", requireAuth, async (req, res) => {
  if (!uuid.safeParse(req.params.researchId).success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }
  try {
    // Explicit membership only. This never grants a general security-log view.
    const project = await prisma.researchProject.findFirst({
      where: {
        id: String(req.params.researchId),
        members: {
          some: {
            userId: req.user!.id,
            leftAt: null,
            projectRole: { in: ["LEADER", "MEMBER", "ADVISER"] },
          },
        },
      },
      select: { id: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project history not found." });
      return;
    }
    let parsed: ReturnType<typeof auditWhere>;
    try {
      parsed = auditWhere({ ...req.query, researchId: project.id });
    } catch {
      badQuery(res);
      return;
    }
    const rows = await prisma.auditLog.findMany({
      where: {
        AND: [
          parsed.where,
          {
            category: { in: ["ACADEMIC", "DOCUMENT"] },
            eventType: {
              in: [
                "ManuscriptSubmission.CREATE",
                "TaskSubmissionAttempt.CREATE",
                "ManuscriptReviewDecision.CREATE",
                "TitleProposalSubmission.UPDATE",
                "OfficialCopy.APPROVE",
                "OfficialCopy.UPDATE",
                "DefenseResultReleased",
                "DefenseBadge.CREATE",
                "ResearchProject.UPDATE",
              ],
            },
          },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        eventType: true,
        action: true,
        entityType: true,
        entityId: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: parsed.limit + 1,
    });
    const events = rows.slice(0, parsed.limit),
      last = events.at(-1);
    res.set("Cache-Control", "no-store").json({
      events,
      coverage:
        "Explicitly project-scoped events; legacy records may be absent.",
      nextCursor:
        rows.length > parsed.limit && last
          ? Buffer.from(
              JSON.stringify({
                at: last.createdAt.toISOString(),
                id: last.id,
                to: parsed.to.toISOString(),
              }),
            ).toString("base64url")
          : null,
    });
  } catch {
    res
      .status(503)
      .json({ error: "Project history is temporarily unavailable." });
  }
});

export default router;
