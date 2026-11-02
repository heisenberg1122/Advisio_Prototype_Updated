import type { RequestHandler } from "express";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { evaluationContext } from "./context.js";
import { COOKIE, EvaluationRuntime } from "./runtime.js";
import { EVALUATION_COURSES, EVALUATION_ROLES } from "./catalog.js";
import { generateToken } from "../middleware/auth.js";

let runtime: EvaluationRuntime | undefined;
export async function initializeEvaluation() {
  runtime = new EvaluationRuntime();
  await runtime.init();
  runtime.surveyUrl();
}
export async function closeEvaluation() {
  await runtime?.close();
  runtime = undefined;
}

// Mount before auditing and native routes. Evaluation requests can never fall
// back to the regular database or accept a client-supplied schema/user identity.
export const evaluationGateway: RequestHandler = async (req, res, next) => {
  if (process.env.ADVISIO_EVALUATION !== "1") return next();
  const service = runtime;
  if (!service)
    return void res
      .status(503)
      .json({ error: "Evaluation setup is not ready." });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const endpoint = req.path;
  if (!endpoint.startsWith("/api/")) return next();
  try {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== service.config.origin
    )
      return void res
        .status(403)
        .json({ error: "Open the evaluation from its configured website." });
    if (endpoint === "/api/health") {
      await service.health();
      return void res.json({
        status: "ok",
        mode: "evaluation",
        database: "connected",
      });
    }
    if (endpoint === "/api/evaluation/config" && req.method === "GET") {
      if (!/^[a-f0-9]{64}$/.test(req.cookies?.[COOKIE] || ""))
        res.cookie(COOKIE, randomBytes(32).toString("hex"), {
          httpOnly: true,
          secure: service.config.secure,
          sameSite: "strict",
          path: "/",
          maxAge: service.config.lifetimeMs,
        });
      return void res.json({
        roles: EVALUATION_ROLES.map(({ id, label }) => ({ id, label })),
        courses: EVALUATION_COURSES.map(({ id, label, college, quota }) => ({
          id,
          label,
          college,
          quota,
        })),
        entryUrl: `${service.config.origin}/evaluate`,
        localOnly: !service.config.secure,
        temporaryStorage: service.config.ephemeralStorage,
      });
    }
    if (endpoint === "/api/evaluation/qr" && req.method === "GET") {
      const png = await QRCode.toBuffer(`${service.config.origin}/evaluate`, {
        width: 700,
        margin: 4,
        errorCorrectionLevel: "M",
      });
      return void res.type("png").send(png);
    }
    if (endpoint === "/api/evaluation/session" && req.method === "POST") {
      const { role, course, acknowledged } = req.body || {};
      if (
        acknowledged !== true ||
        !EVALUATION_ROLES.some((r) => r.id === role) ||
        !EVALUATION_COURSES.some((c) => c.id === course)
      )
        return void res.status(400).json({
          error:
            "Choose your assigned role and program and acknowledge the evaluation notice.",
        });
      const token = req.cookies?.[COOKIE];
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        return void res
          .status(400)
          .json({ error: "Reload the entry page before beginning." });
      const session = await service.begin(token, role, course);
      return void res.status(201).json(service.describe(session));
    }
    const session = await service.find(req.cookies?.[COOKIE]);
    if (!session)
      return void res.status(401).json({
        error:
          "Your evaluation session has ended or expired. Return to the entry page to begin.",
      });
    if (endpoint === "/api/evaluation/session" && req.method === "GET")
      return void res.json(service.describe(session));
    if (
      (endpoint === "/api/evaluation/end" || endpoint === "/api/auth/logout") &&
      req.method === "POST"
    ) {
      await service.end(session);
      res.clearCookie(COOKIE, {
        httpOnly: true,
        secure: service.config.secure,
        sameSite: "strict",
        path: "/",
      });
      return void res.json({ message: "Evaluation session closed." });
    }
    if (endpoint === "/api/evaluation/revision" && req.method === "GET") {
      const filename = service.describe(session).revisionName;
      return void res.download(
        `${service.storageRoot(session.id)}/${filename}`,
        filename,
      );
    }
    if (endpoint.startsWith("/api/evaluation/"))
      return void res
        .status(404)
        .json({ error: "Evaluation action not found." });
    if (
      (endpoint.startsWith("/api/auth/") &&
        ![
          "/api/auth/me",
          "/api/auth/me/appearance",
          "/api/auth/me/color-theme",
        ].includes(endpoint)) ||
      /^\/api\/(integrations|account-invitations|official-copies|signatures|users)(\/|$)/.test(
        endpoint,
      ) ||
      /\/(sign|issue|issue-badges)(\/|$)/.test(endpoint)
    )
      return void res
        .status(403)
        .json({ error: "This action is unavailable during the evaluation." });
    const acquired = service.acquire(session, () => res.destroy());
    const timeout = setTimeout(
      () => res.destroy(),
      Math.max(
        1,
        Math.min(
          service.config.idleMs,
          +session.created_at + service.config.lifetimeMs - Date.now(),
        ),
      ),
    );
    timeout.unref();
    const release = () => {
      clearTimeout(timeout);
      acquired.release();
    };
    res.once("finish", release);
    res.once("close", release);
    // Native authorization still checks the one selected role and project scope.
    req.headers.authorization = `Bearer ${generateToken(session.user_id, 0)}`;
    evaluationContext.run(acquired.scope, next);
  } catch (error: any) {
    console.error(
      "Evaluation request failed:",
      error?.code || error?.name || "unknown",
    );
    res.status(error.statusCode || 503).json({
      error: error.statusCode
        ? error.message
        : "The evaluation workspace is temporarily unavailable. Please ask the facilitator for help.",
    });
  }
};
