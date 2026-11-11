import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  certificateBadgeInclude,
  certificateDeans,
  certificateResearchInclude,
  issueDefenseCertificates,
} from "../services/defense-certificate.service.js";
import { renderDefenseCertificate } from "../services/defense-certificate-pdf.js";
import { evaluationContext } from "../evaluation/context.js";
import { publishEvaluationCertificate } from "../evaluation/certificate-verification.js";

const router = Router();
const id = z.string().uuid();
const finalBadge = { kind: "FINAL_DEFENSE" };
const previewPath = "/defense-sessions/:id/certificate";
const issuancePath = "/defense-sessions/:id/certificates/issuance";

function verificationUrl(code: string) {
  const configured = process.env.WEB_URL || (
    process.env.NODE_ENV === "production" ? "" : "http://localhost:3000"
  );
  const origin = new URL(configured);
  if (origin.username || origin.password ||
      (origin.protocol !== "https:" &&
        (origin.protocol !== "http:" || process.env.NODE_ENV === "production"))) {
    throw new Error("Certificate verification requires a valid WEB_URL (HTTPS in production).");
  }
  return new URL(`/verify/certificate/${code}`, origin).href;
}

router.get([previewPath, `${previewPath}/pdf`], requireAuth, async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  const sessionId = id.safeParse(req.params.id);
  const user = req.user!;
  if (!sessionId.success || !user.roles.includes("RESEARCHER")) {
    return void res.status(404).json({ error: "Certificate not found." });
  }
  try {
    const badge = await prisma.defenseBadge.findFirst({
      where: {
        ...finalBadge,
        defenseSessionId: sessionId.data,
        session: {
          research: {
            members: {
              some: { userId: user.id, leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } },
            },
          },
        },
      },
      select: {
        recipients: true,
        certificates: { where: { recipientId: user.id }, take: 1 },
      },
    });
    const awarded = Array.isArray(badge?.recipients) && badge.recipients.some(
      (recipient) => recipient && typeof recipient === "object" &&
        !Array.isArray(recipient) && recipient.userId === user.id,
    );
    if (!awarded || !badge) {
      return void res.status(404).json({ error: "Certificate not found." });
    }
    const [certificate] = badge.certificates;
    if (!certificate) {
      return void res.status(409).json({
        error: "Your certificate will be available once the Research Coordinator confirms the dean.",
      });
    }
    const url = verificationUrl(certificate.id);
    if (evaluationContext.getStore()) publishEvaluationCertificate(certificate);
    if (/\/pdf\/?$/i.test(req.path)) {
      const pdf = await renderDefenseCertificate(certificate, url);
      res.type("application/pdf").set("Content-Disposition", 'attachment; filename="final-defense-certificate.pdf"').send(pdf);
      return;
    }
    const { recipientName, coordinator, dean, collegeName, researchTitle, awardedAt } = certificate;
    res.json({ recipientName, coordinator, dean, collegeName, researchTitle, awardedAt, verificationUrl: url });
  } catch (error) {
    next(error);
  }
});

router.get("/certificates/verify/:code", async (req, res, next) => {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  const code = id.safeParse(req.params.code);
  try {
    const certificate = code.success && await prisma.defenseCertificate.findFirst({
      where: { id: code.data, badge: finalBadge },
      select: { recipientName: true, collegeName: true, awardedAt: true },
    });
    if (!certificate) {
      return void res.status(404).json({ error: "No issued certificate matches this verification code." });
    }
    res.json(certificate);
  } catch (error) {
    next(error);
  }
});

router.route(issuancePath)
  .get(requireAuth, handleIssuance)
  .post(requireAuth, handleIssuance);

async function handleIssuance(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.set("Cache-Control", "private, no-store");
  const { id: actorId, collegeId, roles } = req.user!;
  if (!collegeId || !roles.includes("RESEARCH_COORDINATOR")) {
    return void res.status(403).json({ error: "Only the college Research Coordinator may confirm certificate issuance." });
  }
  const sessionId = id.safeParse(req.params.id);
  if (!sessionId.success) {
    return void res.status(404).json({ error: "Final Defense badge not found." });
  }
  const deanId = id.safeParse(req.body?.deanId);
  if (req.method === "POST" && !deanId.success) {
    return void res.status(400).json({ error: "Select a dean for this certificate." });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const badge = await tx.defenseBadge.findFirst({
        where: { ...finalBadge, defenseSessionId: sessionId.data, session: { research: { collegeId } } },
        include: {
          ...certificateBadgeInclude,
          session: { include: { research: { include: certificateResearchInclude } } },
        },
      });
      if (!badge) return { status: 404, error: "Final Defense badge not found." };
      if (badge._count.certificates) return { status: 200, issued: true, deans: [] };
      const deans = await certificateDeans(tx, collegeId);
      if (req.method === "GET") return { status: 200, issued: false, deans };
      const dean = deans.find((candidate) => candidate.id === deanId.data);
      if (!dean) return { status: 409, error: "Select an active dean assigned to this college." };
      const inserted = await issueDefenseCertificates(tx, badge, badge.session.research, dean);
      if (inserted) {
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "CREATE",
            entityType: "DefenseCertificate",
            entityId: badge.id,
            researchId: badge.session.researchId,
            newValues: { badgeId: badge.id, deanId: dean.id, count: inserted },
          },
        });
      } else if (!(await tx.defenseCertificate.count({ where: { badgeId: badge.id } }))) {
        return { status: 409, error: "The badge has no valid awarded students." };
      }
      return { status: 200, issued: true, deans: [] };
    });
    const { status, ...body } = result;
    res.status(status).json(body);
  } catch (error) {
    next(error);
  }
}

export default router;
