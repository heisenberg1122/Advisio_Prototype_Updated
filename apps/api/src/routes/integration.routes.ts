import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { googleDriveService } from "../services/google-drive.service.js";

const router = Router();

function requireSystemAdmin(req: Request, res: Response): boolean {
  if (!req.user?.roles.includes("SYSTEM_ADMIN")) {
    res.status(403).json({ error: "System Administrator access is required" });
    return false;
  }
  return true;
}

router.get(
  "/integrations/google-drive/status",
  requireAuth,
  async (req, res) => {
    if (!requireSystemAdmin(req, res)) return;
    try {
      res.json(await googleDriveService.getStatus());
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Unable to read Google Drive status" });
    }
  },
);

router.post(
  "/integrations/google-drive/connect",
  requireAuth,
  async (req, res) => {
    if (!requireSystemAdmin(req, res)) return;
    try {
      res.json({
        authorizationUrl: googleDriveService.createAuthorizationUrl(
          req.user!.id,
        ),
      });
    } catch (error: any) {
      res
        .status(503)
        .json({ error: error.message || "Google OAuth is not configured" });
    }
  },
);

router.get("/integrations/google-drive/callback", async (req, res) => {
  const webUrl = (process.env.WEB_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError = typeof req.query.error === "string" ? req.query.error : "";
  if (oauthError)
    return void res.redirect(
      `${webUrl}/system-admin/dashboard?tab=integrations&drive=cancelled`,
    );
  if (!code || !state)
    return void res.redirect(
      `${webUrl}/system-admin/dashboard?tab=integrations&drive=invalid_callback`,
    );
  try {
    await googleDriveService.completeAuthorization(code, state);
    res.redirect(
      `${webUrl}/system-admin/dashboard?tab=integrations&drive=connected`,
    );
  } catch (error) {
    console.error("[GoogleDriveOAuth] Callback failed", error);
    res.redirect(
      `${webUrl}/system-admin/dashboard?tab=integrations&drive=connection_failed`,
    );
  }
});

router.post(
  "/integrations/google-drive/health-check",
  requireAuth,
  async (req, res) => {
    if (!requireSystemAdmin(req, res)) return;
    try {
      res.json(await googleDriveService.healthCheck());
    } catch (error: any) {
      res
        .status(409)
        .json({ error: error.message || "Google Drive is not connected" });
    }
  },
);

router.post(
  "/integrations/google-drive/disconnect",
  requireAuth,
  async (req, res) => {
    if (!requireSystemAdmin(req, res)) return;
    try {
      res.json(await googleDriveService.disconnect(req.user!.id));
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Unable to disconnect Google Drive" });
    }
  },
);

export default router;
