import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED_DATASET = "ADVISIO-DEMO-LOCAL-V1";
const EXPECTED_APPLICATION = "advisio-demo-local";
const REQUIRED_PERMISSION = Object.freeze({
  RESEARCHER: "research.create",
  ADVISER: "document.upload",
  PANELIST: "evaluation.submit",
  RESEARCH_COORDINATOR: "workflow.create",
  DEAN: "dean.monitor",
  SYSTEM_ADMIN: "system.configure",
});

function assertEnvironment() {
  if (
    process.env.ADVISIO_LOCAL_DEMO !== "1" ||
    process.env.LOCAL_DEMO_EXECUTION !== "1" ||
    process.env.LOCAL_DEMO_DATASET_ID !== EXPECTED_DATASET ||
    process.env.STORAGE_PROVIDER !== "LOCAL"
  ) {
    throw new Error(
      "API verification requires the isolated local demo environment.",
    );
  }
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "5435" ||
    url.pathname !== "/advisio_demo_local" ||
    url.searchParams.get("application_name") !== EXPECTED_APPLICATION ||
    process.env.DATABASE_URL !== process.env.DIRECT_URL
  ) {
    throw new Error(
      "Refusing API verification outside the exact approved local demo database.",
    );
  }
}

async function request(baseUrl, pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function login(baseUrl, account) {
  return request(baseUrl, "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
}

async function main() {
  assertEnvironment();
  const baseUrl =
    process.env.DEMO_API_URL || process.env.API_URL || "http://127.0.0.1:5000";
  const apiUrl = new URL(baseUrl);
  if (!["127.0.0.1", "localhost"].includes(apiUrl.hostname))
    throw new Error("The local demo API verifier only connects to localhost.");

  const credentialPath = path.resolve(
    process.env.LOCAL_DEMO_CREDENTIALS_FILE || ".demo-local/credentials.json",
  );
  const credentials = JSON.parse(await fs.readFile(credentialPath, "utf8"));
  if (
    credentials.datasetId !== EXPECTED_DATASET ||
    credentials.accounts?.length !== 33
  )
    throw new Error(
      "The private credential file does not match the local demo fixture.",
    );

  const health = await request(baseUrl, "/api/health");
  if (!health.response.ok)
    throw new Error(`API health check failed with ${health.response.status}.`);

  const catalog = await request(baseUrl, "/api/colleges");
  const programs = catalog.body.colleges?.flatMap(
    (college) => college.programs || [],
  );
  if (
    !catalog.response.ok ||
    programs?.length !== 20 ||
    programs.some(
      (program) =>
        !Array.isArray(program.researchInterests) ||
        program.researchInterests.length < 10,
    )
  )
    throw new Error(
      "The public academic catalog did not expose interests for all 20 programs.",
    );
  const requiredProgramInterest = Object.freeze({
    BSIT: "Cybersecurity",
    BSTM: "Sustainable Tourism",
    BSHM: "Hospitality Operations",
  });
  for (const [programCode, interest] of Object.entries(
    requiredProgramInterest,
  )) {
    const program = programs.find((item) => item.code === programCode);
    if (!program?.researchInterests.includes(interest))
      throw new Error(
        `${programCode} did not expose its expected program-specific interests.`,
      );
  }

  const tokens = new Map();
  const active = credentials.accounts.filter(
    (account) => account.status === "ACTIVE",
  );
  for (const account of active) {
    const authenticated = await login(baseUrl, account);
    if (!authenticated.response.ok || !authenticated.body.token)
      throw new Error(
        `Normal authentication failed for ${account.key} (${authenticated.response.status}).`,
      );
    const profile = await request(baseUrl, "/api/auth/me", {
      headers: { authorization: `Bearer ${authenticated.body.token}` },
    });
    const requiredPermission = REQUIRED_PERMISSION[account.role];
    if (
      !profile.response.ok ||
      profile.body.user?.email !== account.email ||
      !profile.body.user?.roles?.includes(account.role) ||
      !profile.body.user?.permissions?.includes(requiredPermission)
    ) {
      throw new Error(
        `Role or permission verification failed for ${account.key}.`,
      );
    }
    tokens.set(account.key, authenticated.body.token);
  }

  const pending = credentials.accounts.filter(
    (account) => account.status === "PENDING",
  );
  for (const account of pending) {
    const authenticated = await login(baseUrl, account);
    if (
      authenticated.response.status !== 403 ||
      authenticated.body.status !== "PENDING"
    )
      throw new Error(
        `Pending-account authentication guard failed for ${account.key}.`,
      );
  }

  const adminToken = tokens.get("role:system-admin");
  const studentToken = tokens.get("role:student");
  const adminAccess = await request(baseUrl, "/api/admin/metrics", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const studentAccess = await request(baseUrl, "/api/admin/metrics", {
    headers: { authorization: `Bearer ${studentToken}` },
  });
  if (!adminAccess.response.ok || studentAccess.response.status !== 403)
    throw new Error("Protected-route authorization checks failed.");

  const studentHeaders = { authorization: `Bearer ${studentToken}` };
  const research = await request(baseUrl, "/api/research", {
    headers: studentHeaders,
  });
  const bsitProject = research.body.projects?.find(
    (project) => project.groupName === `${EXPECTED_DATASET}:BSIT`,
  );
  if (!research.response.ok || !bsitProject)
    throw new Error(
      "The BSIT research fixture is not visible to its student account.",
    );
  const documents = await request(
    baseUrl,
    `/api/research/${encodeURIComponent(bsitProject.id)}/documents`,
    { headers: studentHeaders },
  );
  const previewPath = documents.body.documents?.[0]?.versions?.[0]?.webViewLink;
  if (!documents.response.ok || !previewPath)
    throw new Error(
      "The local document workflow did not expose a version preview.",
    );
  const preview = await fetch(`${baseUrl}${previewPath}`, {
    headers: studentHeaders,
  });
  const previewBytes = Buffer.from(await preview.arrayBuffer());
  if (
    !preview.ok ||
    !preview.headers.get("content-type")?.startsWith("application/pdf") ||
    !previewBytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
  ) {
    throw new Error(
      "The authorized local document preview is not a valid PDF response.",
    );
  }

  console.log(
    JSON.stringify(
      {
        endpoint: baseUrl,
        activeLogins: active.length,
        pendingLoginsRejected: pending.length,
        rolesVerified: Object.keys(REQUIRED_PERMISSION).length,
        programInterestCatalogsVerified: programs.length,
        onboardingProgramsVerified: Object.keys(requiredProgramInterest),
        protectedRouteAllowedForSystemAdmin: true,
        protectedRouteDeniedForStudent: true,
        localDocumentPreviewVerified: true,
        passwordsPrinted: false,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
