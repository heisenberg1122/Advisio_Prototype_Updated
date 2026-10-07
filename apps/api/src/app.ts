import "./config/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import organizationRoutes from "./routes/organization.routes";
import researchRoutes from "./routes/research.routes";
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
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// Security and standard middlewares
app.use(helmet());

const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like server-to-server, mobile apps, or curl)
      if (!origin) return callback(null, true);
      if (
        configuredOrigins.length === 0 ||
        configuredOrigins.includes(origin) ||
        configuredOrigins.includes("*") ||
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", organizationRoutes);
app.use("/api/research", researchRoutes);
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
