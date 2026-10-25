import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    // Ping database
    const [features] = await prisma.$queryRaw<
      Array<{ workflowAccessApproval: boolean; milestonePrerequisites: boolean }>
    >`SELECT to_regclass('public.workflow_access_entries') IS NOT NULL AS "workflowAccessApproval",
      (to_regclass('public.milestone_prerequisites') IS NOT NULL AND
       to_regclass('public.project_milestone_states') IS NOT NULL) AS "milestonePrerequisites"`;

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "Advisio Research Management API",
      database: "connected",
      features,
      revision: process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || null,
    });
  } catch (error: any) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "Advisio Research Management API",
      database: "disconnected",
      error: error.message,
    });
  }
});

export default router;
