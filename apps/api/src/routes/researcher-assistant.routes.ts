import { Router } from "express";
import { getWorkspaceById } from "@research-management/auth";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import {
  AssistantRateError,
  ResearcherAssistantService,
  assistantRequestSchema,
  assistantTranslationRequestSchema,
} from "../services/researcher-assistant.service.js";
import {
  assistantTopic,
  type AssistantRequest,
} from "@research-management/shared/src/researcher-assistant";

export function createResearcherAssistantRouter(
  service = new ResearcherAssistantService(),
) {
  const router = Router();
  router.use(requireAuth);
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get("/metrics", requireRole("SYSTEM_ADMIN"), (_req, res) => {
    res.json(service.snapshot());
  });
  router.post("/", async (req, res) => {
    if (Buffer.byteLength(JSON.stringify(req.body || {}), "utf8") > 10_000) {
      res.status(413).json({
        error: "Please shorten the question and recent conversation.",
      });
      return;
    }
    const parsed = assistantRequestSchema
      .or(assistantTranslationRequestSchema)
      .safeParse(req.body);
    if (
      !parsed.success ||
      ("message" in parsed.data &&
        ((parsed.data.page &&
          !assistantTopic(parsed.data.page, parsed.data.workspace)) ||
          (parsed.data.previousTopic &&
            !assistantTopic(parsed.data.previousTopic, parsed.data.workspace))))
    ) {
      res.status(400).json({
        error: "Use a supported question, page and short conversation.",
      });
      return;
    }
    const workspace = parsed.data.workspace ?? "researcher";
    const requiredRole = getWorkspaceById(workspace)?.role;
    if (
      !requiredRole ||
      !req.user!.roles.includes(requiredRole) ||
      (workspace !== "researcher" && workspace !== "system-admin" && !req.user!.collegeId)
    ) {
      res
        .status(403)
        .json({ error: "Forbidden: workspace unauthorized", requiredRole });
      return;
    }
    const controller = new AbortController();
    const close = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on("close", close);
    try {
      const identity = {
        id: req.user!.id,
        collegeId: req.user!.collegeId,
        permissions: req.user!.permissions,
      };
      const reply =
        "translateTo" in parsed.data
          ? await service.translate(identity, parsed.data, controller.signal)
          : await service.answer(
              identity,
              parsed.data as AssistantRequest,
              controller.signal,
            );
      if (!res.destroyed) res.json(reply);
    } catch (error) {
      if (res.destroyed) return;
      if (error instanceof AssistantRateError) {
        res.setHeader("Retry-After", String(error.retryAfter));
        res.status(429).json({ error: error.message });
      } else
        res.status(503).json({
          error: "Assistant help is temporarily unavailable. Please try Guide.",
        });
    } finally {
      res.off("close", close);
    }
  });
  return router;
}
export default createResearcherAssistantRouter();
