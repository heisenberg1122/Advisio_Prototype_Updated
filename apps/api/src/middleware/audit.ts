import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { auditContext } from "../services/audit-contract.js";
import { aggregateSecurity } from "../services/security-audit.service.js";

export const auditMiddleware: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  res.setHeader("X-Request-ID", requestId);
  res.once("finish", () => {
    const login = /^\/api\/auth\/(login|google)(?:\?|$)/.test(req.originalUrl);
    const recovery =
      /^\/api\/auth\/(forgot-password|reset-password)(?:\?|$)/.test(
        req.originalUrl,
      );
    const source = req.ip || "unknown";
    const target =
      typeof req.body?.email === "string" ? req.body.email : "unknown";
    if (login && [401, 403, 429].includes(res.statusCode))
      void aggregateSecurity(
        res.statusCode === 429 ? "LOGIN_THROTTLED" : "LOGIN_FAILED",
        target,
        source,
      );
    else if (recovery && [400, 401, 403, 429].includes(res.statusCode))
      void aggregateSecurity("RECOVERY_REJECTED", target, source);
    else if (res.statusCode === 403)
      void aggregateSecurity(
        "ACCESS_DENIED",
        `${req.method}:${req.baseUrl}:${String(req.route?.path || "unknown")}`,
        source,
      );
  });
  auditContext.run(
    {
      requestId,
      actor: () => req.user,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    },
    next,
  );
};
