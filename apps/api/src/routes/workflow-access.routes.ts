import { Router, type Request, type RequestHandler } from "express";
import { prisma, type Prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getCollegeScope } from "../lib/college-scope.js";
import { randomBytes } from "node:crypto";
const router = Router();
type User = NonNullable<Request["user"]>;
const fail = (message: string, statusCode = 403): never => {
  throw Object.assign(new Error(message), { statusCode });
};
// Async handlers return their promise so route tests and Express share error behavior.
function route(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error: any) {
      if (!error.statusCode)
        console.error("Workflow access operation failed", error);
      res.status(error.statusCode || 500).json({
        error: error.statusCode
          ? error.message
          : "Workflow access could not be updated. Please retry.",
      });
    }
  };
}
const person = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  universityId: true,
  program: { select: { name: true } },
} as const;
export async function lockWorkflowAccess(
  tx: Prisma.TransactionClient,
  id: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workflow-access:${id}`}))`;
}
async function loadWorkflow(id: string, db: Prisma.TransactionClient = prisma) {
  const workflow = await db.workflow.findUnique({
    where: { id },
    include: { creator: { select: person } },
  });
  if (!workflow) return fail("Workflow not found.", 404);
  const type = await db.researchType.findUnique({
    where: { id: workflow.researchTypeId },
    include: { program: true },
  });
  if (!type) return fail("Workflow program not found.", 404);
  return { ...workflow, program: type.program };
}
function canManage(user: User, w: Awaited<ReturnType<typeof loadWorkflow>>) {
  const scope = getCollegeScope(user);
  return (
    w.createdBy === user.id ||
    (user.roles.some((r) => ["SYSTEM_ADMIN", "RPO"].includes(r)) &&
      (scope.kind === "institution" ||
        (scope.kind === "college" &&
          scope.collegeId === w.program.collegeId &&
          (!user.programId || user.programId === w.program.id))))
  );
}
async function managed(
  id: string,
  user: User,
  db: Prisma.TransactionClient = prisma,
) {
  const w = await loadWorkflow(id, db);
  if (!canManage(user, w))
    fail(
      "Only the workflow owner or an authorized administrator can manage access.",
    );
  return w;
}
async function eligible(
  id: string,
  w: Awaited<ReturnType<typeof loadWorkflow>>,
  db: Prisma.TransactionClient,
) {
  const user = await db.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });
  if (w.status === "ARCHIVED") fail("This workflow is archived.", 409);
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.roles.some((r) => r.role.name === "RESEARCHER") ||
    user.collegeId !== w.program.collegeId ||
    user.programId !== w.program.id
  )
    fail(
      "An active researcher account in this workflow's college and program is required.",
    );
}
const ownerUrl = (id: string) =>
  `/professor/dashboard?tab=builder&workflowView=participants&workflowId=${id}`;
async function notify(
  db: Prisma.TransactionClient,
  recipientId: string,
  title: string,
  message: string,
  entityId: string,
  actionUrl: string,
) {
  await db.notification.create({
    data: {
      recipientId,
      type: "WORKFLOW_CHANGED",
      title,
      message,
      entityType: "WORKFLOW_ACCESS",
      entityId,
      actionUrl,
    },
  });
}
async function audit(
  db: Prisma.TransactionClient,
  userId: string,
  id: string,
  action: string,
) {
  await db.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      entityType: "WorkflowAccessEntry",
      entityId: id,
      newValues: { action },
    },
  });
}
async function member(
  db: Prisma.TransactionClient,
  workflowId: string,
  userId: string,
) {
  return db.workflowEnrollment.findUnique({
    where: { workflowId_userId: { workflowId, userId } },
  });
}
async function codeWorkflow(
  code: string,
  db: Prisma.TransactionClient = prisma,
) {
  const row = await db.workflow.findUnique({
    where: { inviteCode: code },
    select: { id: true },
  });
  if (!row) return fail("This workflow link is invalid or expired.", 404);
  const w = await loadWorkflow(row.id, db);
  if (
    w.inviteCode !== code ||
    !w.inviteExpiresAt ||
    w.inviteExpiresAt <= new Date()
  )
    return fail("This workflow link is invalid or expired.", 404);
  return w;
}
export const previewWorkflow = route(async (req, res) => {
  const w = await codeWorkflow(String(req.params.code).trim().toUpperCase());
  await eligible(req.user!.id, w, prisma);
  const enrollment = await member(prisma, w.id, req.user!.id);
  if (enrollment && enrollment.status !== "ACTIVE")
    return fail(
      "Your access was removed. Ask the professor for a new direct invitation.",
    );
  const entry = await prisma.workflowAccessEntry.findUnique({
    where: {
      workflowId_userId_kind: {
        workflowId: w.id,
        userId: req.user!.id,
        kind: "REQUEST",
      },
    },
  });
  res.json({
    invitation: {
      id: w.id,
      name: w.name,
      professor: {
        firstName: w.creator.firstName,
        lastName: w.creator.lastName,
      },
      expiresAt: w.inviteExpiresAt,
      alreadyJoined: enrollment?.status === "ACTIVE",
      requestStatus: entry?.status,
    },
  });
});
export const requestWorkflow = route(async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const candidate = await codeWorkflow(code);
  const result = await prisma.$transaction(async (tx) => {
    await lockWorkflowAccess(tx, candidate.id);
    const w = await loadWorkflow(candidate.id, tx);
    if (
      w.inviteCode !== code ||
      !w.inviteExpiresAt ||
      w.inviteExpiresAt <= new Date()
    ) {
      return fail("This workflow link is invalid or expired.", 404);
    }
    await eligible(req.user!.id, w, tx);
    const enrollment = await member(tx, w.id, req.user!.id);
    if (enrollment?.status === "ACTIVE")
      return { alreadyJoined: true, workflow: { id: w.id, name: w.name } };
    if (enrollment)
      return fail(
        "Your access was removed. Ask the professor for a new direct invitation.",
      );
    const key = { workflowId: w.id, userId: req.user!.id, kind: "REQUEST" };
    const prior = await tx.workflowAccessEntry.findUnique({
      where: { workflowId_userId_kind: key },
    });
    if (prior?.status === "DECLINED")
      return fail(
        "Your request was declined. Ask the professor for an invitation.",
        409,
      );
    if (prior?.status === "PENDING")
      return {
        entry: prior,
        pendingApproval: true,
        workflow: { id: w.id, name: w.name },
      };
    const entry = await tx.workflowAccessEntry.upsert({
      where: { workflowId_userId_kind: key },
      create: { ...key, actorId: req.user!.id },
      update: {
        status: "PENDING",
        createdAt: new Date(),
        decidedBy: null,
        decidedAt: null,
      },
    });
    await notify(
      tx,
      w.createdBy,
      "Workflow join request",
      `${req.user!.firstName || req.user!.email} requested to join ${w.name}.`,
      entry.id,
      ownerUrl(w.id),
    );
    await notify(
      tx,
      req.user!.id,
      "Workflow request pending",
      `Your request to join ${w.name} has been sent. Please wait for the professor to approve it.`,
      entry.id,
      "/student/tasks",
    );
    await audit(tx, req.user!.id, entry.id, "REQUEST");
    return {
      entry,
      pendingApproval: true,
      workflow: { id: w.id, name: w.name },
    };
  });
  res.status(202).json(result);
});
export const generateWorkflowCode = route(async (req, res) => {
  const invitation = await prisma.$transaction(async (tx) => {
    await lockWorkflowAccess(tx, String(req.params.id));
    await managed(String(req.params.id), req.user!, tx);
    return tx.workflow.update({
      where: { id: String(req.params.id) },
      data: {
        inviteCode: randomBytes(5).toString("hex").toUpperCase(),
        inviteExpiresAt: new Date(Date.now() + 30 * 86400000),
      },
      select: { id: true, inviteCode: true, inviteExpiresAt: true },
    });
  });
  res.json({ invitation });
});
router.use(requireAuth);
router.delete(
  "/:id/invitation",
  route(async (req, res) => {
    await prisma.$transaction(async (tx) => {
      await lockWorkflowAccess(tx, String(req.params.id));
      await managed(String(req.params.id), req.user!, tx);
      await tx.workflow.update({
        where: { id: String(req.params.id) },
        data: { inviteCode: null, inviteExpiresAt: null },
      });
    });
    res.json({ success: true });
  }),
);
router.get(
  "/access/me",
  route(async (req, res) => {
    const entries = await prisma.workflowAccessEntry.findMany({
      where: { userId: req.user!.id },
      include: { workflow: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ entries });
  }),
);
router.get(
  "/:id/access",
  route(async (req, res) => {
    await managed(String(req.params.id), req.user!);
    const entries = await prisma.workflowAccessEntry.findMany({
      where: { workflowId: String(req.params.id) },
      include: { user: { select: person } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ entries });
  }),
);
router.get(
  "/:id/access/contacts",
  route(async (req, res) => {
    const w = await managed(String(req.params.id), req.user!);
    const q = String(req.query.q || "")
      .trim()
      .slice(0, 100);
    const contacts = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        collegeId: w.program.collegeId,
        programId: w.program.id,
        roles: { some: { role: { name: "RESEARCHER" } } },
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" as const } },
                { lastName: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: person,
      orderBy: { lastName: "asc" },
      take: 100,
    });
    res.json({ contacts });
  }),
);
router.post(
  "/:id/access/invitations",
  route(async (req, res) => {
    const id = String(req.params.id);
    await managed(id, req.user!);
    if (
      !Array.isArray(req.body.userIds) ||
      !req.body.userIds.length ||
      req.body.userIds.length > 50 ||
      req.body.userIds.some(
        (v: unknown) =>
          typeof v !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            v,
          ),
      )
    )
      return void res
        .status(400)
        .json({ error: "Select between 1 and 50 registered researchers." });
    const results = [];
    for (const userId of [...new Set<string>(req.body.userIds)]) {
      try {
        results.push(
          await prisma.$transaction(async (tx) => {
            await lockWorkflowAccess(tx, id);
            const w = await managed(id, req.user!, tx);
            await eligible(userId, w, tx);
            if ((await member(tx, id, userId))?.status === "ACTIVE")
              return { userId, status: "Already a member" };
            const key = { workflowId: id, userId, kind: "INVITATION" };
            const prior = await tx.workflowAccessEntry.findUnique({
              where: { workflowId_userId_kind: key },
            });
            if (prior?.status === "PENDING")
              return { userId, status: "Already invited" };
            const entry = await tx.workflowAccessEntry.upsert({
              where: { workflowId_userId_kind: key },
              create: { ...key, actorId: req.user!.id },
              update: {
                status: "PENDING",
                actorId: req.user!.id,
                createdAt: new Date(),
                decidedAt: null,
                decidedBy: null,
              },
            });
            const thread = await tx.mailThread.create({
              data: {
                subject: `Workflow invitation: ${w.name}`.slice(0, 255),
                createdById: req.user!.id,
                participants: {
                  create: [
                    {
                      userId: req.user!.id,
                      recipientType: "SENDER",
                      readAt: new Date(),
                    },
                    { userId, recipientType: "TO" },
                  ],
                },
                messages: {
                  create: {
                    senderId: req.user!.id,
                    body: `You are invited to join ${w.name}. Accept this invitation to access its milestones, tasks, and resources, or decline it below.`,
                    sentAt: new Date(),
                  },
                },
              },
            });
            await tx.workflowAccessEntry.update({
              where: { id: entry.id },
              data: { mailThreadId: thread.id },
            });
            await notify(
              tx,
              userId,
              "Workflow invitation",
              `You are invited to join ${w.name}. Open your Advisio inbox to accept or decline.`,
              entry.id,
              `/student/inbox?thread=${thread.id}`,
            );
            await audit(tx, req.user!.id, entry.id, "INVITE");
            return { userId, status: "Sent" };
          }),
        );
      } catch (error: any) {
        results.push({
          userId,
          status: "Failed",
          error: error.statusCode
            ? error.message
            : "Invitation could not be sent. Please retry.",
        });
      }
    }
    res.json({ results });
  }),
);
router.post(
  "/access/:entryId/decision",
  route(async (req, res) => {
    const action = String(req.body.action || "");
    const entry = await prisma.$transaction(async (tx) => {
      const initial = await tx.workflowAccessEntry.findUnique({
        where: { id: String(req.params.entryId) },
      });
      if (!initial) return fail("Request or invitation not found.", 404);
      await lockWorkflowAccess(tx, initial.workflowId);
      const current = (await tx.workflowAccessEntry.findUnique({
        where: { id: initial.id },
      }))!;
      const w = await loadWorkflow(current.workflowId, tx);
      const ownerAction =
        current.kind === "REQUEST"
          ? ["approve", "decline"].includes(action)
          : action === "revoke";
      const recipientAction =
        current.kind === "REQUEST"
          ? action === "cancel"
          : ["accept", "decline"].includes(action);
      if (ownerAction) {
        if (!canManage(req.user!, w)) fail("You cannot manage this workflow.");
      } else if (!recipientAction || current.userId !== req.user!.id)
        fail("You cannot perform this action.");
      const status = (
        {
          approve: "APPROVED",
          accept: "ACCEPTED",
          decline: "DECLINED",
          cancel: "CANCELLED",
          revoke: "REVOKED",
        } as Record<string, string>
      )[action];
      if (current.status !== "PENDING") {
        if (current.status === status) return current;
        return fail(
          "This request or invitation has already been resolved.",
          409,
        );
      }
      if (["approve", "accept"].includes(action)) {
        await eligible(current.userId, w, tx);
        const enrollment = await member(tx, w.id, current.userId);
        if (
          action === "approve" &&
          enrollment &&
          enrollment.status !== "ACTIVE"
        )
          return fail("Removed researchers require a new direct invitation.");
        await tx.workflowEnrollment.upsert({
          where: {
            workflowId_userId: { workflowId: w.id, userId: current.userId },
          },
          create: { workflowId: w.id, userId: current.userId },
          update: { status: "ACTIVE", joinedAt: new Date() },
        });
        await tx.workflowAccessEntry.updateMany({
          where: {
            workflowId: w.id,
            userId: current.userId,
            kind: "REQUEST",
            status: "PENDING",
          },
          data: {
            status: "APPROVED",
            decidedAt: new Date(),
            decidedBy: req.user!.id,
          },
        });
      }
      const updated = await tx.workflowAccessEntry.update({
        where: { id: current.id },
        data: { status, decidedAt: new Date(), decidedBy: req.user!.id },
      });
      await notify(
        tx,
        ownerAction ? current.userId : w.createdBy,
        `Workflow ${status.toLowerCase()}`,
        `${w.name}: ${status.toLowerCase()}.`,
        current.id,
        ownerAction ? "/student/tasks" : ownerUrl(w.id),
      );
      await audit(tx, req.user!.id, current.id, action);
      return updated;
    });
    res.json({ entry });
  }),
);
router.post(
  "/access/:entryId/resend",
  route(async (req, res) => {
    await prisma.$transaction(async (tx) => {
      const initial = await tx.workflowAccessEntry.findUnique({
        where: { id: String(req.params.entryId) },
      });
      if (!initial) return fail("Invitation not found.", 404);
      await lockWorkflowAccess(tx, initial.workflowId);
      const e = (await tx.workflowAccessEntry.findUnique({
        where: { id: initial.id },
      }))!;
      const w = await managed(e.workflowId, req.user!, tx);
      await eligible(e.userId, w, tx);
      if (e.kind !== "INVITATION" || e.status !== "PENDING" || !e.mailThreadId)
        return fail("Only pending invitations can be reminded.", 409);
      const last = await tx.mailMessage.findFirst({
        where: { threadId: e.mailThreadId },
        orderBy: { createdAt: "desc" },
      });
      if (last && Date.now() - last.createdAt.getTime() < 60000)
        return fail(
          "Please wait a minute before sending another reminder.",
          429,
        );
      await tx.mailMessage.create({
        data: {
          threadId: e.mailThreadId,
          senderId: req.user!.id,
          body: `Reminder: you are invited to join ${w.name}. Use the invitation actions to respond.`,
          sentAt: new Date(),
        },
      });
      await tx.mailThread.update({
        where: { id: e.mailThreadId },
        data: { updatedAt: new Date() },
      });
      await tx.mailParticipant.updateMany({
        where: { threadId: e.mailThreadId, userId: e.userId },
        data: { readAt: null, archivedAt: null, trashedAt: null },
      });
      await notify(
        tx,
        e.userId,
        "Workflow invitation reminder",
        `You are invited to join ${w.name}.`,
        e.id,
        `/student/inbox?thread=${e.mailThreadId}`,
      );
    });
    res.json({ success: true });
  }),
);
export default router;
