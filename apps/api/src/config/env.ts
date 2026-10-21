import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

// Load the repository-level configuration before services are evaluated.
// A service-specific apps/api/.env may override it when present.
dotenv.config({ path: path.resolve(configDir, "../../../../.env") });
dotenv.config({
  path: path.resolve(configDir, "../../.env"),
  override:
    process.env.NODE_ENV !== "test" &&
    process.env.NODE_ENV !== "production" &&
    process.env.ADVISIO_LOCAL_DEMO !== "1",
});

if (process.env.ADVISIO_LOCAL_DEMO === "1") {
  const expected = {
    host: "127.0.0.1",
    port: "5435",
    database: "advisio_demo_local",
    applicationName: "advisio-demo-local",
  };
  for (const name of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required in local demo mode.`);
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (
      url.hostname !== expected.host ||
      url.port !== expected.port ||
      database !== expected.database ||
      url.searchParams.get("schema") !== "public" ||
      url.searchParams.get("application_name") !== expected.applicationName
    ) {
      throw new Error(
        `${name} must target only 127.0.0.1:5435/advisio_demo_local in local demo mode.`,
      );
    }
  }
  if (
    process.env.DATABASE_URL !== process.env.DIRECT_URL ||
    process.env.STORAGE_PROVIDER !== "LOCAL"
  ) {
    throw new Error(
      "Local demo mode requires identical database URLs and STORAGE_PROVIDER=LOCAL.",
    );
  }
  for (const name of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "GOOGLE_REDIRECT_URI",
    "GOOGLE_DRIVE_FOLDER_ID",
    "GOOGLE_CALENDAR_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_SIGN_IN_CLIENT_ID",
    "VITE_GOOGLE_SIGN_IN_CLIENT_ID",
  ]) {
    if (process.env[name]?.trim()) {
      throw new Error(`${name} must be empty in local demo mode.`);
    }
  }
}

if (process.env.NODE_ENV === "production") {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Production requires DATABASE_URL.");
  }
  if (process.env.ALLOW_LOCAL_STORAGE_FALLBACK === "true") {
    throw new Error(
      "Local document storage fallback must be disabled in production.",
    );
  }
  if (
    process.env.ALLOW_DEMO_ACCOUNT_PROVISIONING === "true" ||
    process.env.ALLOW_THEME_DEMO_ACCOUNTS === "true"
  ) {
    throw new Error(
      "Demo account provisioning must be disabled in production.",
    );
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
