import app from "./app";
import { startNotificationEmailWorker } from "./services/notification-email.service.js";
import { startDeadlineEmailWorker } from "./services/deadline-email.service.js";
import { startFileDeletionWorker } from "./services/file-deletion.service.js";

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Advisio Backend API is running on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
});
const stopFileDeletionWorker = startFileDeletionWorker();
const stopNotificationEmailWorker = startNotificationEmailWorker();
const stopDeadlineEmailWorker = startDeadlineEmailWorker();

// Graceful shutdown handlers
const shutdown = () => {
  console.log("Shutting down Advisio API server...");
  stopFileDeletionWorker();
  stopNotificationEmailWorker();
  stopDeadlineEmailWorker();
  server.close(() => {
    console.log("Server closed cleanly.");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
