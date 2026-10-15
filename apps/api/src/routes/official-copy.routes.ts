import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { loadVersionFile } from "../services/document-signing.service.js";
import {
  OfficialCopyError,
  officialCopyService,
} from "../services/official-copy.service.js";

const router = Router();

function respondError(res: any, error: unknown) {
  if (error instanceof OfficialCopyError)
    return res
      .status(error.statusCode)
      .json({ error: error.message, code: error.code });
  const message =
    error instanceof Error ? error.message : "Official-copy operation failed.";
  return res.status(500).json({ error: message });
}

router.get(
  "/research/:researchId/official-copies",
  requireAuth,
  async (req, res) => {
    try {
      res.json(
        await officialCopyService.list(
          req.user!,
          req.params.researchId as string,
        ),
      );
    } catch (error) {
      respondError(res, error);
    }
  },
);

router.post(
  "/documents/versions/:versionId/official-copy",
  requireAuth,
  async (req, res) => {
    try {
      const result = await officialCopyService.finalize({
        sourceVersionId: req.params.versionId as string,
        user: req.user!,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      respondError(res, error);
    }
  },
);

router.post(
  "/official-copies/:officialCopyId/sign",
  requireAuth,
  async (req, res) => {
    try {
      const { password, confirmation, placements } = req.body || {};
      if (confirmation !== true)
        throw new OfficialCopyError("Signing confirmation is required.");
      if (!password || typeof password !== "string")
        throw new OfficialCopyError("Enter your password to confirm signing.");
      const account = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { passwordHash: true },
      });
      if (
        !account?.passwordHash ||
        !(await bcrypt.compare(password, account.passwordHash))
      )
        throw new OfficialCopyError(
          "Your password could not be verified.",
          401,
          "SIGNER_AUTHENTICATION_FAILED",
        );
      const result = await officialCopyService.sign({
        officialCopyId: req.params.officialCopyId as string,
        user: req.user!,
        placements: Array.isArray(placements) ? placements : [],
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      respondError(res, error);
    }
  },
);

router.post(
  "/official-copies/:officialCopyId/verify",
  requireAuth,
  async (req, res) => {
    try {
      const signatureId =
        typeof req.body?.signatureId === "string"
          ? req.body.signatureId
          : undefined;
      res.json(
        await officialCopyService.verify(
          req.user!,
          req.params.officialCopyId as string,
          signatureId,
        ),
      );
    } catch (error) {
      respondError(res, error);
    }
  },
);

router.patch(
  "/official-copies/:officialCopyId/revoke",
  requireAuth,
  async (req, res) => {
    try {
      if (typeof req.body?.reason !== "string")
        throw new OfficialCopyError("A revocation reason is required.");
      res.json(
        await officialCopyService.revoke({
          officialCopyId: req.params.officialCopyId as string,
          reason: req.body.reason,
          user: req.user!,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        }),
      );
    } catch (error) {
      respondError(res, error);
    }
  },
);

router.get(
  "/official-copies/files/:fileId",
  requireAuth,
  async (req, res) => {
    try {
      const artifact = await officialCopyService.resolveArtifact(
        req.user!,
        req.params.fileId as string,
      );
      const buffer = await loadVersionFile(artifact);
      const download = req.query.download === "1";
      if (download) {
        await prisma.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "DOWNLOAD",
            entityType: artifact.entityType,
            entityId: artifact.entityId,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        });
      }
      res.type(artifact.mimeType);
      res.setHeader(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename="${artifact.fileName.replace(/"/g, "")}"`,
      );
      res.send(buffer);
    } catch (error) {
      respondError(res, error);
    }
  },
);

export default router;
