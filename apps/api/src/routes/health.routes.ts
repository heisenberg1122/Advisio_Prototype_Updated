import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    // Ping database
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "Advisio Research Management API",
      database: "connected",
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
