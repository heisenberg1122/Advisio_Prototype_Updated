import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

// Load the repository-level configuration before services are evaluated.
// A service-specific apps/api/.env may override it when present.
dotenv.config({ path: path.resolve(configDir, "../../../../.env") });
dotenv.config({ path: path.resolve(configDir, "../../.env"), override: process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "production" });

if (process.env.NODE_ENV === "production") {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Production requires DATABASE_URL.");
  }
  if (process.env.ALLOW_LOCAL_STORAGE_FALLBACK === "true") {
    throw new Error("Local document storage fallback must be disabled in production.");
  }
  if (
    process.env.ALLOW_DEMO_ACCOUNT_PROVISIONING === "true" ||
    process.env.ALLOW_THEME_DEMO_ACCOUNTS === "true"
  ) {
    throw new Error("Demo account provisioning must be disabled in production.");
  }
  if (
    process.env.STORAGE_PROVIDER === "GOOGLE_DRIVE" &&
    (process.env.INTEGRATION_ENCRYPTION_KEY?.length || 0) < 32
  ) {
    throw new Error(
      "Google Drive storage requires an INTEGRATION_ENCRYPTION_KEY of at least 32 characters in production.",
    );
  }
}
