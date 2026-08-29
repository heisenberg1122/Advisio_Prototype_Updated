import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import organizationRoutes from "./routes/organization.routes";
import researchRoutes from "./routes/research.routes";
import workflowRoutes from "./routes/workflow.routes";
import userRoutes from "./routes/user.routes";
import documentRoutes from "./routes/document.routes";
import evaluationRoutes from "./routes/evaluation.routes";
import adminRoutes from "./routes/admin.routes";
import consultationRoutes from "./routes/consultation.routes";
import notificationRoutes from "./routes/notification.routes";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();

// Security and standard middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
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
app.use("/api/consultations", consultationRoutes);
app.use("/api/notifications", notificationRoutes);

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
