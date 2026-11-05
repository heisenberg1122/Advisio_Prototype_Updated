import type { RequestHandler } from "express";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { evaluationContext } from "./context.js";
import { COOKIE, EvaluationRuntime } from "./runtime.js";
import {
  EVALUATION_COURSES,
  EVALUATION_COLLEGES,
  EVALUATION_ROLES,
  ROLE_TASKS,
  evaluationCourse,
} from "./catalog.js";
import { evaluationInvitationUrl } from "./invitation.js";
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
    if (endpoint === "/api/evaluation/capacity" && req.method === "GET")
      return void res.json(await service.capacity());
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
        roles: EVALUATION_ROLES.map(({ id, label }) => ({
          id,
          label,
          tasks: ROLE_TASKS[id],
        })),
        courses: EVALUATION_COURSES.map(
          ({ id, label, college, collegeCode, quota }) => ({
            id,
            label,
            college,
            collegeCode,
            quota,
          }),
        ),
        colleges: EVALUATION_COLLEGES.map(
          ({ id, label, college, collegeCode }) => ({
            id,
            label,
            college,
            collegeCode,
          }),
        ),
        entryUrl: `${service.config.origin}/evaluate`,
        invitationUrl: service.config.invitationUrl,
        localOnly: !service.config.secure,
        temporaryStorage: service.config.ephemeralStorage,
      });
    }
    if (endpoint === "/api/evaluation/qr" && req.method === "GET") {
      const png = await QRCode.toBuffer(
        evaluationInvitationUrl(
          service.config.origin,
          req.query,
          process.env.EVALUATION_LAUNCH_URL,
        ),
        {
          width: 700,
          margin: 4,
          errorCorrectionLevel: "M",
        },
      );
      return void res.type("png").send(png);
    }
    if (endpoint === "/api/evaluation/session" && req.method === "POST") {
      const { role, course, acknowledged } = req.body || {};
      const selectedCourse = evaluationCourse(course);
      if (
        acknowledged !== true ||
        !EVALUATION_ROLES.some((r) => r.id === role) ||
        !selectedCourse
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
      const session = await service.begin(token, role, selectedCourse.id);
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
      [
        "/api/evaluation/switch-role",
        "/api/evaluation/switch-scenario",
      ].includes(endpoint) &&
      req.method === "POST"
    ) {
      const body = req.body;
      const switchingRole = endpoint.endsWith("switch-role");
      const key = switchingRole ? "role" : "scenario";
      if (
        !body ||
        Object.keys(body).length !== 1 ||
        typeof body[key] !== "string"
      )
        return void res
          .status(400)
          .json({
            error:
              "Choose only an available role or scenario. College and workspace cannot be changed.",
          });
      const nextToken = randomBytes(32).toString("hex");
      const updated = switchingRole
        ? await service.switchRole(session, body.role, nextToken)
        : await service.switchScenario(session, body.scenario, nextToken);
      res.cookie(COOKIE, nextToken, {
        httpOnly: true,
        secure: service.config.secure,
        sameSite: "strict",
        path: "/",
        maxAge: Math.max(
          1,
          +session.created_at + service.config.lifetimeMs - Date.now(),
        ),
      });
      return void res.json(service.describe(updated));
    }
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
    if (endpoint === "/api/evaluation/request-letter" && req.method === "GET") {
      if (session.role !== "professor")
        return void res
          .status(403)
          .json({
            error:
              "The prepared request letter is for the Coordinator scenario.",
          });
      return void res.download(
        `${service.storageRoot(session.id)}/Prepared_Defense_Approval_Request.pdf`,
        "Prepared_Defense_Approval_Request.pdf",
      );
    }
    if (endpoint === "/api/evaluation/revision" && req.method === "GET") {
      if (!service.describe(session).revisionAvailable)
        return void res
          .status(404)
          .json({
            error:
              "The prepared revision belongs to the In progress student scenario.",
          });
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
    const demoSignatureRead =
      session.role === "dean" &&
      !!session.accounts?.dean.scenarios &&
      req.method === "GET" &&
      /^\/api\/users\/me\/signature(?:\/image)?$/.test(endpoint);
    const demoDeanSign =
      session.role === "dean" &&
      !!session.accounts?.dean.scenarios &&
      req.method === "POST" &&
      /^\/api\/documents\/versions\/[a-f0-9-]{36}\/sign$/.test(endpoint);
    if (
      !demoSignatureRead &&
      !demoDeanSign &&
      ((endpoint.startsWith("/api/auth/") &&
        ![
          "/api/auth/me",
          "/api/auth/me/appearance",
          "/api/auth/me/color-theme",
        ].includes(endpoint)) ||
        /^\/api\/(integrations|account-invitations|official-copies|signatures|users)(\/|$)/.test(
          endpoint,
        ) ||
        /\/(sign|issue|issue-badges)(\/|$)/.test(endpoint))
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
    await evaluationContext.run(acquired.scope, async () => {
      if (demoDeanSign) {
        const versionId = endpoint.split("/")[4];
        const version = await acquired.scope.prisma.documentVersion.findFirst({
          where: {
            id: versionId,
            document: {
              documentType: "DEAN_DEFENSE_APPROVAL",
              deanInboxMessages: { some: { recipientId: session.user_id } },
            },
          },
          select: { id: true },
        });
        if (!version)
          return void res
            .status(403)
            .json({
              error:
                "Only a Dean approval request addressed to this demo Dean may be signed.",
            });
      }
      req.headers.authorization = `Bearer ${generateToken(session.user_id, 0)}`;
      next();
    });
  } catch (error: any) {
    console.error(
      "Evaluation request failed:",
      error?.code || error?.name || "unknown",
    );
    res.status(error.statusCode || 503).json({
      error: error.statusCode
        ? error.message
        : "The evaluation workspace is temporarily unavailable. Try again or email advisio.main@gmail.com for help.",
    });
  }
};
