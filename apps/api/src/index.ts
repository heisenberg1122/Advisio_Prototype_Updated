import app from "./app";
import { startNotificationEmailWorker } from "./services/notification-email.service.js";
import { startDeadlineEmailWorker } from "./services/deadline-email.service.js";
import { startFileDeletionWorker } from "./services/file-deletion.service.js";
import { startSecurityAuditWorker } from "./services/security-audit.service.js";
import { verifyAuditRuntimeRole } from "./services/audit-runtime.service.js";
import { initializeEvaluation, closeEvaluation } from "./evaluation/gateway.js";

const PORT = process.env.PORT || 5000;
const evaluation = process.env.ADVISIO_EVALUATION === "1";
if (evaluation) await initializeEvaluation();
else await verifyAuditRuntimeRole();

const listening = () => {
  console.log(`🚀 Advisio Backend API is running on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
};
const server = evaluation
  ? app.listen(
      Number(PORT),
      process.env.EVALUATION_BIND_HOST || "127.0.0.1",
      listening,
    )
  : app.listen(PORT, listening);
const stopFileDeletionWorker = evaluation
  ? () => {}
  : startFileDeletionWorker();
const stopNotificationEmailWorker = evaluation
  ? () => {}
  : startNotificationEmailWorker();
const stopDeadlineEmailWorker = evaluation
  ? () => {}
  : startDeadlineEmailWorker();
const stopSecurityAuditWorker = evaluation
  ? () => {}
  : startSecurityAuditWorker();

// Graceful shutdown handlers
const shutdown = () => {
  console.log("Shutting down Advisio API server...");
  stopFileDeletionWorker();
  stopNotificationEmailWorker();
  stopDeadlineEmailWorker();
  stopSecurityAuditWorker();
  server.close(async () => {
    if (evaluation) await closeEvaluation();
    console.log("Server closed cleanly.");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
