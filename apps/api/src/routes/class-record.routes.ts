import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  addRecordItem,
  addRecordSession,
  ClassRecordError,
  getClassRecord,
  getMyClassRecord,
  initializeClassRecord,
  listRecordClasses,
  periodCode,
  recordItem,
  recordMarks,
  recordRelease,
  recordScores,
  recordSession,
  recordSettings,
  releaseClassPeriod,
  saveRecordMarks,
  saveRecordScores,
  saveRecordSettings,
  uuid,
} from "../services/class-record.service.js";
const router = Router();
router.use(requireAuth);
const handle =
  (fn: (req: any) => Promise<unknown>) => async (req: any, res: any) => {
    try {
      res.json(await fn(req));
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({
            error:
              error.issues[0]?.message || "Check the class record details.",
          });
        return;
      }
      if (error instanceof ClassRecordError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Class record request failed", error);
      res
        .status(500)
        .json({ error: "Unable to load or save the class record." });
    }
  };
router.get(
  "/",
  handle((req) => listRecordClasses(req.user, true)),
);
router.get(
  "/mine",
  handle((req) => listRecordClasses(req.user, false)),
);
router.get(
  "/:workflowId/mine",
  handle((req) =>
    getMyClassRecord(uuid.parse(req.params.workflowId), req.user),
  ),
);
router.get(
  "/:workflowId",
  handle((req) => getClassRecord(uuid.parse(req.params.workflowId), req.user)),
);
router.post(
  "/:workflowId/initialize",
  handle((req) =>
    initializeClassRecord(uuid.parse(req.params.workflowId), req.user),
  ),
);
const actions = [
  ["settings", recordSettings, saveRecordSettings],
  ["items", recordItem, addRecordItem],
  ["scores", recordScores, saveRecordScores],
  ["sessions", recordSession, addRecordSession],
  ["attendance", recordMarks, saveRecordMarks],
  ["release", recordRelease, releaseClassPeriod],
] as const;
for (const [path, schema, save] of actions)
  router.post(
    `/:workflowId/periods/:period/${path}`,
    handle((req) =>
      (save as any)(
        uuid.parse(req.params.workflowId),
        periodCode.parse(req.params.period),
        req.user,
        schema.parse(req.body),
      ),
    ),
  );
export default router;
