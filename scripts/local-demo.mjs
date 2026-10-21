import { spawn } from "node:child_process";

const EXPECTED = Object.freeze({
  host: "127.0.0.1",
  port: "5435",
  database: "advisio_demo_local",
  applicationName: "advisio-demo-local",
});

function assertConfiguredTarget() {
  if (
    process.env.ADVISIO_LOCAL_DEMO !== "1" ||
    process.env.LOCAL_DEMO_EXECUTION !== "1"
  ) {
    throw new Error(
      "Local demo commands require ADVISIO_LOCAL_DEMO=1 and LOCAL_DEMO_EXECUTION=1.",
    );
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local demo commands never run with NODE_ENV=production.");
  }
  for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required.`);
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (
      url.hostname !== EXPECTED.host ||
      url.port !== EXPECTED.port ||
      database !== EXPECTED.database ||
      url.searchParams.get("schema") !== "public" ||
      url.searchParams.get("application_name") !== EXPECTED.applicationName
    ) {
      throw new Error(
        `${name} must target exactly 127.0.0.1:5435/advisio_demo_local with schema=public and application_name=advisio-demo-local.`,
      );
    }
  }
  if (process.env.DATABASE_URL !== process.env.DIRECT_URL) {
    throw new Error(
      "DATABASE_URL and DIRECT_URL must be identical for local demo commands.",
    );
  }
  if (process.env.STORAGE_PROVIDER !== "LOCAL") {
    throw new Error("Local demo commands require STORAGE_PROVIDER=LOCAL.");
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
      throw new Error(
        `${name} must remain empty in the isolated local demo environment.`,
      );
    }
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let executable = command;
    let childArgs = args;
    if (process.platform === "win32" && command === "npm") {
      if (!process.env.npm_execpath)
        throw new Error(
          "npm_execpath is unavailable for the local demo command.",
        );
      executable = process.execPath;
      childArgs = [process.env.npm_execpath, ...args];
    }
    const child = spawn(executable, childArgs, {
      cwd: new URL("..", import.meta.url),
      env: process.env,
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal)
        reject(new Error(`${executable} ended with signal ${signal}.`));
      else if (code === 0) resolve();
      else reject(new Error(`${executable} exited with code ${code}.`));
    });
  });
}

async function buildDatabase() {
  // The schema is unchanged by the demo fixture, so compiling without regenerating
  // Prisma avoids replacing a Windows query-engine DLL held by a running dev server.
  await run("npm", [
    "exec",
    "--",
    "tsc",
    "-p",
    "packages/database/tsconfig.json",
  ]);
}

async function databaseCommand(command, extraEnvironment = {}) {
  await run(
    "npm",
    [
      "--workspace=@research-management/database",
      "run",
      "demo:local",
      "--",
      command,
    ],
    { env: { ...process.env, ...extraEnvironment } },
  );
}

async function main() {
  assertConfiguredTarget();
  const command = process.argv[2];
  if (!["init", "verify", "reset", "cleanup", "dev"].includes(command || "")) {
    throw new Error("Usage: local-demo.mjs <init|verify|reset|cleanup|dev>");
  }
  if (command === "dev") {
    await buildDatabase();
    await databaseCommand("preflight");
    // Start the two applications directly so Turbo cannot filter the
    // already-validated demo database and storage variables.
    await Promise.all([
      run("npm", ["--workspace=api", "run", "dev"]),
      run("npm", ["--workspace=web", "run", "dev", "--", "--strictPort"]),
    ]);
    return;
  }

  await buildDatabase();
  if (command === "init") {
    await databaseCommand("credentials");
    await databaseCommand("preflight");
    await run("npm", [
      "exec",
      "--",
      "prisma",
      "migrate",
      "deploy",
      "--schema",
      "packages/database/prisma/schema.prisma",
    ]);
    await databaseCommand("seed");
    await databaseCommand("verify");
    return;
  }
  if (command === "verify") {
    await databaseCommand("verify");
    return;
  }
  if (command === "cleanup") {
    await databaseCommand("cleanup", {
      LOCAL_DEMO_CLEANUP_CONFIRMATION: `DELETE:${process.env.LOCAL_DEMO_DATASET_ID}`,
    });
    return;
  }
  await databaseCommand("cleanup", {
    LOCAL_DEMO_CLEANUP_CONFIRMATION: `DELETE:${process.env.LOCAL_DEMO_DATASET_ID}`,
  });
  await databaseCommand("seed");
  await databaseCommand("verify");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
