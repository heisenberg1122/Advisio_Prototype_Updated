import { Router, type RequestHandler } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  monitoringIdSchema,
  monitoringQuerySchema,
  reportTypeSchema,
} from "../schemas/dean-monitoring.schema.js";
import { deanCollege } from "../services/dean-monitoring-scope.js";
import {
  deanDefenses,
  deanDefenseDetails,
} from "../services/dean-defense.service.js";
import { deanReport } from "../services/dean-report.service.js";
import {
  reportCsv,
  reportPdf,
} from "../services/dean-report-export.service.js";
import { ZodError } from "zod";

const router = Router();
const run =
  (handler: RequestHandler): RequestHandler =>
  async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: "Check the selected filters.",
          details: error.flatten(),
        });
        return;
      }
      next(error);
    }
  };
const authorize: RequestHandler = (req, res, next) => {
  try {
    deanCollege(req.user!);
    res.setHeader("Cache-Control", "private, no-store");
    next();
  } catch (e) {
    next(e);
  }
};
// Bounded per-account export budget and concurrency protection; no shared login/recovery quota.
const exportsByUser = new Map<
  string,
  { until: number; count: number; active: boolean }
>();
const exportLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  for (const [key, entry] of exportsByUser)
    if (entry.until <= now && !entry.active) exportsByUser.delete(key);
  const entry = exportsByUser.get(req.user!.id) || {
    until: now + 60000,
    count: 0,
    active: false,
  };
  if (
    entry.active ||
    entry.count >= 5 ||
    (exportsByUser.size >= 10000 && !exportsByUser.has(req.user!.id))
  ) {
    res.setHeader("Retry-After", "60");
    res
      .status(429)
      .json({ error: "Please wait before generating another report." });
    return;
  }
  entry.count++;
  entry.active = true;
  exportsByUser.set(req.user!.id, entry);
  const release = () => {
    entry.active = false;
  };
  res.once("finish", release);
  res.once("close", release);
  next();
};
const access = [requireAuth, authorize];
router.get(
  "/dean/defenses",
  ...access,
  run(async (req, res) => {
    res.json(
      await deanDefenses(req.user!, monitoringQuerySchema.parse(req.query)),
    );
  }),
);
router.get(
  "/dean/defenses/:id",
  ...access,
  run(async (req, res) => {
    res.json(
      await deanDefenseDetails(
        req.user!,
        monitoringIdSchema.parse(req.params.id),
      ),
    );
  }),
);
router.get(
  "/dean/reports/:reportType/export",
  ...access,
  exportLimit,
  run(async (req, res) => {
    const q = monitoringQuerySchema.parse(req.query),
      type = reportTypeSchema.parse(req.params.reportType);
    const report = await deanReport(req.user!, q, type, true);
    const format = q.format || "pdf";
    const body = format === "csv" ? reportCsv(report) : await reportPdf(report);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="advisio-${type}-${report.generatedAt.slice(0, 10)}.${format}"`,
    );
    res
      .type(format === "csv" ? "text/csv; charset=utf-8" : "application/pdf")
      .send(body);
  }),
);
router.get(
  "/dean/reports/:reportType",
  ...access,
  run(async (req, res) => {
    res.json(
      await deanReport(
        req.user!,
        monitoringQuerySchema.parse(req.query),
        reportTypeSchema.parse(req.params.reportType),
      ),
    );
  }),
);
export default router;
