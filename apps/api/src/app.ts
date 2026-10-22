import "./config/env.js";
import express from "express";
import cors from "cors";
import { isAllowedOrigin } from "./lib/security-config.js";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import organizationRoutes from "./routes/organization.routes";
import researchRoutes from "./routes/research.routes";
import workspaceRoutes from "./routes/workspace.routes";
import workflowRoutes from "./routes/workflow.routes";
import userRoutes from "./routes/user.routes";
import documentRoutes from "./routes/document.routes";
import evaluationRoutes from "./routes/evaluation.routes";
import adminRoutes from "./routes/admin.routes";
import deanRoutes from "./routes/dean.routes";
import consultationRoutes from "./routes/consultation.routes";
import notificationRoutes from "./routes/notification.routes";
import adviserRequestRoutes from "./routes/adviser-request.routes";
import chatRoutes from "./routes/chat.routes";
import realtimeRoutes from "./routes/realtime.routes";
import liveDefenseRoutes from "./routes/live-defense.routes";
import integrationRoutes from "./routes/integration.routes";
import calendarRoutes from "./routes/calendar.routes";
import groupFileRoutes from "./routes/group-file.routes";
import mailRoutes from "./routes/mail.routes";
import defensePacketRoutes from "./routes/defense-packet.routes";
import pdfEvaluationRoutes from "./routes/pdf-evaluation.routes";
import reviewerAssignmentRoutes from "./routes/reviewer-assignment.routes";
import officialCopyRoutes from "./routes/official-copy.routes";
import facultyProfileRoutes from "./routes/faculty-profile.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// Render terminates HTTPS at its proxy. Trust only that first hop so IP-based
// rate limits and secure request metadata use the real client address.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security and standard middlewares
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(
        Object.assign(new Error("Origin is not allowed."), { statusCode: 403 }),
      );
    },
    credentials: true,
  }),
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
// PNG data URLs need room for base64; keep other JSON endpoints at the default limit.
app.use(
  [
    "/api/documents/versions/:versionId/sign",
    "/api/mail/attachments/:id/sign",
    "/api/official-copies/:officialCopyId/sign",
    "/api/defense-sessions/:id/pdf-evaluation/sign",
    "/api/defense-sessions/:id/pdf-evaluation",
  ],
  express.json({ limit: "3mb" }),
);
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", organizationRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/users", userRoutes);
app.use("/api", documentRoutes);
app.use("/api", evaluationRoutes);
app.use("/api", adminRoutes);
app.use("/api", deanRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/adviser-requests", adviserRequestRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api", liveDefenseRoutes);
app.use("/api", integrationRoutes);
app.use("/api", calendarRoutes);
app.use("/api", groupFileRoutes);
app.use("/api/mail", mailRoutes);
app.use("/api", defensePacketRoutes);
app.use("/api", pdfEvaluationRoutes);
app.use("/api", reviewerAssignmentRoutes);
app.use("/api", officialCopyRoutes);
app.use("/api/faculty-profiles", facultyProfileRoutes);

// Root fallback
app.get("/", (_req, res) => {
  res.json({
    name: "Advisio Research Management API",
    status: "running",
    documentation: "/api/health",
  });
});

// Error handling middleware
app.use(errorHandler);

export default app;
