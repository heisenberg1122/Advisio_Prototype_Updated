import app from "./app";
import { startNotificationEmailWorker } from "./services/notification-email.service.js";
import { startDeadlineEmailWorker } from "./services/deadline-email.service.js";
import { startFileDeletionWorker } from "./services/file-deletion.service.js";
import { startSecurityAuditWorker } from "./services/security-audit.service.js";
import { verifyAuditRuntimeRole } from "./services/audit-runtime.service.js";

const PORT = process.env.PORT || 5000;
await verifyAuditRuntimeRole();

const server = app.listen(PORT, () => {
  console.log(`🚀 Advisio Backend API is running on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
});
const stopFileDeletionWorker = startFileDeletionWorker();
const stopNotificationEmailWorker = startNotificationEmailWorker();
const stopDeadlineEmailWorker = startDeadlineEmailWorker();
const stopSecurityAuditWorker = startSecurityAuditWorker();

// Graceful shutdown handlers
const shutdown = () => {
  console.log("Shutting down Advisio API server...");
  stopFileDeletionWorker();
  stopNotificationEmailWorker();
  stopDeadlineEmailWorker();
  stopSecurityAuditWorker();
  server.close(() => {
    console.log("Server closed cleanly.");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
