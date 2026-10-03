import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { countActiveAdviseeGroups } from "../lib/adviser-capacity.js";

const router = Router();

const requestInclude = {
  research: {
    include: {
      members: {
        where: { leftAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  },
  adviser: { select: { id: true, firstName: true, lastName: true, email: true } },
  requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  requestFormDocument: {
    include: {
      versions: {
        orderBy: { versionNumber: "desc" as const },
        take: 1,
        select: { id: true, fileName: true, mimeType: true, storagePath: true, googleDriveFileId: true },
      },
    },
  },
} as const;

// GET /api/adviser-requests — advisers see incoming requests; researchers see requests for their projects.
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const isAdviser = req.user.roles.includes("ADVISER");
    const requests = await prisma.adviserRequest.findMany({
      where: isAdviser
        ? { adviserId: req.user.id }
        : { research: { members: { some: { userId: req.user.id, leftAt: null } } } },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json({ requests });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch adviser requests" });
  }
});

// POST /api/adviser-requests — a research group asks a faculty member to advise them.
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const { researchId, adviserId, note, requestFormDocumentId } = req.body;
    if (!researchId || !adviserId) return void res.status(400).json({ error: "researchId and adviserId are required" });

    const project = await prisma.researchProject.findFirst({
      where: { id: researchId, members: { some: { userId: req.user.id, leftAt: null } } },
      include: { members: { where: { projectRole: "ADVISER", leftAt: null } } },
    });
    if (!project) return void res.status(403).json({ error: "You are not an active member of this research group" });
    if (project.members.length) return void res.status(409).json({ error: "This group already has an adviser" });

    const adviser = await prisma.user.findFirst({
      where: { id: adviserId, roles: { some: { role: { name: "ADVISER" } } }, status: "ACTIVE" },
    });
    if (!adviser) return void res.status(404).json({ error: "Adviser is unavailable" });
    const activeGroups = await countActiveAdviseeGroups(prisma, adviser.id);
    if (!adviser.isAcceptingAdvisees) return void res.status(409).json({ error: "This adviser is not accepting new requests" });
    if (activeGroups >= adviser.maxAdviseeGroups) return void res.status(409).json({ error: "This adviser has reached their maximum number of active groups" });

    if (requestFormDocumentId) {
      const requestForm = await prisma.document.findFirst({
        where: { id: requestFormDocumentId, researchId, documentType: "ADVISER_REQUEST_FORM" },
      });
      if (!requestForm) return void res.status(400).json({ error: "The uploaded adviser request form is invalid." });
    }

    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.adviserRequest.upsert({
        where: { researchId_adviserId: { researchId, adviserId } },
        update: { status: "PENDING", note: note?.trim() || null, requestFormDocumentId: requestFormDocumentId || null, responseNote: null, respondedAt: null, requestedById: req.user!.id },
        create: { researchId, adviserId, requestedById: req.user!.id, note: note?.trim() || null, requestFormDocumentId: requestFormDocumentId || null },
        include: requestInclude,
      });
      await tx.notification.create({
        data: {
          recipientId: adviserId,
          type: "ADVISER_REQUESTED",
          title: "New adviser request",
          message: `${project.title} would like you to serve as their adviser.`,
          entityType: "AdviserRequest",
          entityId: created.id,
        },
      });
      return created;
    });
    res.status(201).json({ request });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create adviser request" });
  }
});

// PATCH /api/adviser-requests/:id/respond — target adviser accepts or rejects with an optional note.
router.patch("/:id/respond", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const { decision, note } = req.body as { decision?: string; note?: string };
    if (!decision || !["accept", "reject"].includes(decision)) {
      return void res.status(400).json({ error: "decision must be accept or reject" });
    }
    const existing = await prisma.adviserRequest.findUnique({ where: { id: req.params.id as string } });
    if (!existing || existing.adviserId !== req.user.id) return void res.status(404).json({ error: "Adviser request not found" });
    if (existing.status !== "PENDING") return void res.status(409).json({ error: "This request has already been decided" });

    const accepted = decision === "accept";
    const request = await prisma.$transaction(async (tx) => {
      if (accepted) {
        const assignedAdviser = await tx.researchMember.findFirst({
          where: { researchId: existing.researchId, projectRole: "ADVISER", leftAt: null, userId: { not: req.user!.id } },
        });
        if (assignedAdviser) throw new Error("GROUP_ALREADY_ASSIGNED");
        const adviser = await tx.user.findUnique({ where: { id: req.user!.id }, select: { maxAdviseeGroups: true, isAcceptingAdvisees: true } });
        if (!adviser?.isAcceptingAdvisees) throw new Error("ADVISER_NOT_ACCEPTING");
        const existingMembership = await tx.researchMember.findUnique({
          where: { researchId_userId_projectRole: { researchId: existing.researchId, userId: req.user!.id, projectRole: "ADVISER" } },
        });
        const activeGroups = await countActiveAdviseeGroups(tx, req.user!.id);
        if (!existingMembership || existingMembership.leftAt) {
          if (activeGroups >= adviser.maxAdviseeGroups) throw new Error("ADVISER_CAPACITY_REACHED");
        }
        await tx.researchMember.upsert({
          where: { researchId_userId_projectRole: { researchId: existing.researchId, userId: req.user!.id, projectRole: "ADVISER" } },
          update: { leftAt: null },
          create: { researchId: existing.researchId, userId: req.user!.id, projectRole: "ADVISER" },
        });
        await tx.adviserRequest.updateMany({
          where: { researchId: existing.researchId, id: { not: existing.id }, status: "PENDING" },
          data: { status: "CANCELLED", respondedAt: new Date(), responseNote: "Another adviser accepted this group." },
        });
      }
      const updated = await tx.adviserRequest.update({
        where: { id: existing.id },
        data: { status: accepted ? "ACCEPTED" : "REJECTED", responseNote: note?.trim() || null, respondedAt: new Date() },
        include: requestInclude,
      });
      await tx.notification.create({
        data: {
          recipientId: existing.requestedById,
          type: "ADVISER_REQUEST_DECIDED",
          title: accepted ? "Adviser request accepted" : "Adviser request declined",
          message: note?.trim() || (accepted ? "Your group now has an assigned adviser." : "You may select another available adviser."),
          entityType: "AdviserRequest",
          entityId: existing.id,
        },
      });
      return updated;
    }, { isolationLevel: "Serializable" });
    res.json({ request });
  } catch (error: any) {
    if (error.message === "ADVISER_NOT_ACCEPTING") return void res.status(409).json({ error: "You are not accepting new adviser requests" });
    if (error.message === "ADVISER_CAPACITY_REACHED" || error.code === "P2034") return void res.status(409).json({ error: "Your adviser capacity was just reached. Refresh before accepting another group." });
    if (error.message === "GROUP_ALREADY_ASSIGNED") return void res.status(409).json({ error: "This group already has an adviser" });
    res.status(500).json({ error: error.message || "Failed to respond to adviser request" });
  }
});

export default router;
