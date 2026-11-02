import { Router, type RequestHandler } from "express";
import { z, ZodError } from "zod";
import {
  acceptAccountInvitationSchema,
  inviteAccountSchema,
  invitationTokenSchema,
  reviewAccountInvitationSchema,
} from "@research-management/validations/account-invitations";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth";
import { recoveryRateLimit } from "../middleware/recovery-rate-limit.js";
import { validateBody } from "../middleware/validate";
import {
  acceptAccountInvitation,
  createAccountInvitation,
  previewAccountInvitation,
  resendAccountInvitation,
  revokeAccountInvitation,
  reviewAccountInvitation,
} from "../services/account-invitation.service.js";

const router = Router();
const systemAdministrator: RequestHandler = (req, res, next) => {
  if (!req.user?.roles.includes("SYSTEM_ADMIN"))
    return void res
      .status(403)
      .json({ error: "System administrator access is required." });
  next();
};
const handle =
  (action: RequestHandler): RequestHandler =>
  async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await action(req, res, next);
    } catch (error: any) {
      const status = error instanceof ZodError ? 400 : error.statusCode || 503;
      res
        .status(status)
        .json({
          error:
            error instanceof ZodError
              ? "Check the invitation details and try again."
              : error.statusCode
                ? error.message
                : "Account invitations are temporarily unavailable. Please try again later.",
        });
    }
  };

router.post(
  "/preview",
  recoveryRateLimit,
  validateBody(invitationTokenSchema),
  handle(async (req, res) => {
    res.json({ invitation: await previewAccountInvitation(req.body.token) });
  }),
);
router.post(
  "/accept",
  recoveryRateLimit,
  validateBody(acceptAccountInvitationSchema),
  handle(async (req, res) => {
    res.json(await acceptAccountInvitation(req.body.token, req.body.password));
  }),
);
router.post(
  "/accept-existing",
  requireAuth,
  recoveryRateLimit,
  validateBody(invitationTokenSchema),
  handle(async (req, res) => {
    res.json(
      await acceptAccountInvitation(req.body.token, undefined, req.user!.id),
    );
  }),
);
router.use(requireAuth, (req, res, next) => {
  if (!req.user?.roles.some((role) => ["SYSTEM_ADMIN", "DEAN"].includes(role)))
    return void res
      .status(403)
      .json({
        error: "System administrator or college Dean access is required.",
      });
  next();
});
router.get(
  "/",
  handle(async (req, res) => {
    if (!req.user!.roles.includes("SYSTEM_ADMIN") && !req.user!.collegeId)
      return void res
        .status(403)
        .json({ error: "An assigned college is required." });
    const invitations = await prisma.accountInvitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      where: req.user!.roles.includes("SYSTEM_ADMIN")
        ? {}
        : { collegeId: req.user!.collegeId!, createdById: req.user!.id },
      select: {
        id: true,
        email: true,
        universityId: true,
        firstName: true,
        lastName: true,
        roleNames: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        deliveredAt: true,
        acceptedAt: true,
        verificationNote: true,
        reviewNote: true,
        reviewedAt: true,
        createdById: true,
        college: { select: { id: true, name: true, code: true } },
      },
    });
    res.json({ invitations });
  }),
);
router.post(
  "/",
  recoveryRateLimit,
  validateBody(inviteAccountSchema),
  handle(async (req, res) => {
    res
      .status(201)
      .json(
        await createAccountInvitation(
          req.body,
          req.user!.id,
          req.user!.collegeId,
        ),
      );
  }),
);
router.post(
  "/:id/resend",
  recoveryRateLimit,
  handle(async (req, res) => {
    res.json(
      await resendAccountInvitation(
        z.string().uuid().parse(req.params.id),
        req.user!.id,
        req.user!.collegeId,
      ),
    );
  }),
);
router.post(
  "/:id/revoke",
  handle(async (req, res) => {
    res.json(
      await revokeAccountInvitation(
        z.string().uuid().parse(req.params.id),
        req.user!.id,
        req.user!.collegeId,
      ),
    );
  }),
);
router.post(
  "/:id/approve",
  systemAdministrator,
  recoveryRateLimit,
  validateBody(reviewAccountInvitationSchema),
  handle(async (req, res) => {
    res.json(
      await reviewAccountInvitation(
        z.string().uuid().parse(req.params.id),
        req.user!.id,
        req.body,
        true,
      ),
    );
  }),
);
router.post(
  "/:id/reject",
  systemAdministrator,
  validateBody(reviewAccountInvitationSchema),
  handle(async (req, res) => {
    res.json(
      await reviewAccountInvitation(
        z.string().uuid().parse(req.params.id),
        req.user!.id,
        req.body,
        false,
      ),
    );
  }),
);
export default router;
