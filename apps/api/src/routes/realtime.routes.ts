import { Router, Request, Response } from "express";
import crypto from "crypto";
import { optionalAuth } from "../middleware/auth";
import { sseManager } from "../realtime/sse";

const router = Router();

// GET /api/realtime/events - SSE endpoint
router.get("/events", optionalAuth, (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Disables response buffering in Nginx reverse proxy
  });

  const clientId = `sse-${crypto.randomUUID()}`;
  const userId = req.user?.id || req.user?.email;

  sseManager.addClient({
    id: clientId,
    userId,
    res,
  });
});

// GET /api/realtime/status - Health / connection metrics
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    activeConnections: sseManager.getActiveCount(),
  });
});

export default router;
