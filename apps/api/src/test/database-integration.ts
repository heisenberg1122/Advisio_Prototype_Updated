const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function assertIsolatedIntegrationDatabase(): void {
  if (process.env.RUN_DATABASE_INTEGRATION_TESTS !== "1") {
    throw new Error(
      "Database integration tests require RUN_DATABASE_INTEGRATION_TESTS=1.",
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Database integration tests require DATABASE_URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid PostgreSQL connection string.",
    );
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Database integration tests require PostgreSQL.");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!databaseName || !databaseName.toLowerCase().includes("test")) {
    throw new Error(
      `Refusing to run database integration tests against non-test database "${databaseName || "unknown"}".`,
    );
  }

  if (
    !LOCAL_DATABASE_HOSTS.has(parsed.hostname.toLowerCase()) &&
    process.env.ALLOW_REMOTE_INTEGRATION_DATABASE !== "1"
  ) {
    throw new Error(
      "Refusing to run database integration tests against a remote host without ALLOW_REMOTE_INTEGRATION_DATABASE=1.",
    );
  }
}
