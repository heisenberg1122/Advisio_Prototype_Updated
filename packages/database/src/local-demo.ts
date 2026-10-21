import { PrismaClient, type InstitutionalRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedReferenceData } from "./reference-data.js";
import { VERIFIED_PROGRAMS, programCatalogKey } from "./program-catalog.js";
import {
  MAX_RESEARCH_INTERESTS,
  researchInterestsForProgram,
} from "./research-interest-catalog.js";
import { demoEmail, demoUniversityId } from "./theme-demo-accounts.js";

const prisma = new PrismaClient();
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const LOCAL_DEMO_DATASET_ID = "ADVISIO-DEMO-LOCAL-V1";
const LOCAL_DEMO_DATASET_UUID = "ad150d00-0000-4000-8000-000000000001";
export const LOCAL_DEMO_APPLICATION_NAME = "advisio-demo-local";
export const LOCAL_DEMO_DATABASE_NAME = "advisio_demo_local";
export const LOCAL_DEMO_HOST = "127.0.0.1";
export const LOCAL_DEMO_PORT = "5435";
const CREDENTIAL_FORMAT = "advisio-local-demo-credentials-v1" as const;
const REQUIRED_COLLEGES = [
  "COA",
  "CEA",
  "CHTM",
  "CNP",
  "SAS",
  "SBPA",
  "SOE",
  "SHS",
  "CIT",
] as const;
const REQUIRED_ROLES: InstitutionalRole[] = [
  "RESEARCHER",
  "ADVISER",
  "PANELIST",
  "RESEARCH_COORDINATOR",
  "RPO",
  "REB",
  "VPAA",
  "SYSTEM_ADMIN",
];

type AccountDefinition = {
  key: string;
  universityId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: InstitutionalRole;
  collegeCode?: string;
  programCode?: string;
  status: "ACTIVE" | "PENDING";
  faculty?: boolean;
  cohort: "role" | "program" | "onboarding";
};

const roleAccountTuples = [
  [
    "student",
    "STUDENT",
    "Ari",
    "Dela Cruz",
    "RESEARCHER",
    "CIT",
    "BSIT",
    false,
  ],
  ["adviser", "ADVISER", "Elena", "Navarro", "ADVISER", "CIT", "BSIT", true],
  [
    "professor",
    "PROFESSOR",
    "Paolo",
    "Villanueva",
    "RESEARCH_COORDINATOR",
    "CIT",
    "BSIT",
    true,
  ],
  ["panelist", "PANELIST", "Marisol", "Cruz", "PANELIST", "CIT", "BSIT", true],
  [
    "panelist-2",
    "PANELIST-2",
    "Victor",
    "Santos",
    "PANELIST",
    "CHTM",
    "BSTM",
    true,
  ],
  [
    "panelist-3",
    "PANELIST-3",
    "Lina",
    "Torres",
    "PANELIST",
    "CHTM",
    "BSHM",
    true,
  ],
  ["dean", "DEAN", "Aurelia", "Mendoza", "RPO", "CHTM", undefined, true],
  ["reb", "REB", "Rafael", "Bautista", "REB", "CNP", undefined, true],
  ["vpaa", "VPAA", "Isabel", "Ramos", "VPAA", undefined, undefined, true],
  [
    "system-admin",
    "SYSTEM-ADMIN",
    "System",
    "Administrator",
    "SYSTEM_ADMIN",
    undefined,
    undefined,
    false,
  ],
] as const;

const roleAccounts: AccountDefinition[] = roleAccountTuples.map(
  ([
    key,
    suffix,
    firstName,
    lastName,
    role,
    collegeCode,
    programCode,
    faculty,
  ]) => ({
    key: `role:${key}`,
    universityId: `DEMO-LOCAL-${suffix}`,
    email: `${key}@advisio-demo.local.invalid`,
    firstName,
    lastName,
    role: role as InstitutionalRole,
    collegeCode,
    programCode,
    faculty: Boolean(faculty),
    status: "ACTIVE",
    cohort: "role",
  }),
);

const programAccounts: AccountDefinition[] = VERIFIED_PROGRAMS.map(
  (offering) => ({
    key: `program:${offering.collegeCode}:${offering.code}`,
    universityId: demoUniversityId(offering.collegeCode, offering.code),
    email: demoEmail(offering.collegeCode, offering.code),
    firstName: "Program",
    lastName: `${offering.code} Researcher`,
    role: "RESEARCHER",
    collegeCode: offering.collegeCode,
    programCode: offering.code,
    status: "ACTIVE",
    cohort: "program",
  }),
);

const onboardingAccounts: AccountDefinition[] = ["BSIT", "BSTM", "BSHM"].map(
  (programCode) => {
    const offering = VERIFIED_PROGRAMS.find(
      (item) => item.code === programCode,
    )!;
    return {
      key: `onboarding:${programCode}`,
      universityId: `DEMO-ONBOARD-${programCode}`,
      email: `onboarding.${programCode.toLowerCase()}@advisio-demo.local.invalid`,
      firstName: "Onboarding",
      lastName: `${programCode} Researcher`,
      role: "RESEARCHER" as const,
      collegeCode: offering.collegeCode,
      programCode,
      status: "PENDING" as const,
      cohort: "onboarding" as const,
    };
  },
);

export const LOCAL_DEMO_ACCOUNTS = [
  ...roleAccounts,
  ...programAccounts,
  ...onboardingAccounts,
];

type CredentialFile = {
  format: typeof CREDENTIAL_FORMAT;
  datasetId: typeof LOCAL_DEMO_DATASET_ID;
  generatedAt: string;
  accounts: Array<{
    key: string;
    email: string;
    password: string;
    role: InstitutionalRole;
    status: "ACTIVE" | "PENDING";
    collegeCode?: string;
    programCode?: string;
  }>;
};

type DatabaseIdentity = {
  databaseName: string;
  databaseUser: string;
  schemaName: string;
  applicationName: string;
  isReplica: boolean;
};

const projectDefinitions = [
  {
    key: "BSIT",
    collegeCode: "CIT",
    programCode: "BSIT",
    title: "AquaWise: Campus Water Use Monitoring and Leak Reporting",
    groupName: `${LOCAL_DEMO_DATASET_ID}:BSIT`,
    status: "REVISION" as const,
    documentLifecycle: "IN_REVIEW" as const,
    taskStatus: "UNDER_REVIEW" as const,
    reviewStatus: "SUBMITTED" as const,
    recommendation: "MAJOR_REVISION" as const,
    defenseStatus: "PENDING_ACKNOWLEDGEMENT" as const,
    queueStatus: "WAITING" as const,
    currentStage: 2,
    versions: 2,
  },
  {
    key: "BSTM",
    collegeCode: "CHTM",
    programCode: "BSTM",
    title: "Lakbay Pampanga: An Accessible Heritage Tourism Planner",
    groupName: `${LOCAL_DEMO_DATASET_ID}:BSTM`,
    status: "DEFENSE" as const,
    documentLifecycle: "IN_REVIEW" as const,
    taskStatus: "UNDER_REVIEW" as const,
    reviewStatus: "DRAFT" as const,
    recommendation: null,
    defenseStatus: "SCHEDULED" as const,
    queueStatus: "WAITING" as const,
    currentStage: 6,
    versions: 1,
  },
  {
    key: "BSHM",
    collegeCode: "CHTM",
    programCode: "BSHM",
    title: "Zero-Waste Kitchen Operations for Small Hospitality Enterprises",
    groupName: `${LOCAL_DEMO_DATASET_ID}:BSHM`,
    status: "COMPLETED" as const,
    documentLifecycle: "APPROVED" as const,
    taskStatus: "APPROVED" as const,
    reviewStatus: "SUBMITTED" as const,
    recommendation: "APPROVE" as const,
    defenseStatus: "COMPLETED" as const,
    queueStatus: "COMPLETED" as const,
    currentStage: 7,
    versions: 1,
  },
] as const;

function required(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function targetFromUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid PostgreSQL URL.`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error(`${label} must use PostgreSQL.`);
  return {
    normalized: url.toString(),
    host: url.hostname.toLowerCase(),
    port: url.port,
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    user: decodeURIComponent(url.username),
    schema: url.searchParams.get("schema"),
    applicationName: url.searchParams.get("application_name"),
  };
}

export function validateLocalDemoEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (
    environment.ADVISIO_LOCAL_DEMO !== "1" ||
    environment.LOCAL_DEMO_EXECUTION !== "1"
  )
    throw new Error("Local demo execution flags are missing.");
  if (environment.NODE_ENV === "production")
    throw new Error("Local demo commands never run in production.");
  if (required(environment, "LOCAL_DEMO_DATASET_ID") !== LOCAL_DEMO_DATASET_ID)
    throw new Error(`LOCAL_DEMO_DATASET_ID must be ${LOCAL_DEMO_DATASET_ID}.`);
  if (
    required(environment, "LOCAL_DEMO_DATABASE_NAME") !==
      LOCAL_DEMO_DATABASE_NAME ||
    required(environment, "LOCAL_DEMO_DATABASE_HOST") !== LOCAL_DEMO_HOST ||
    required(environment, "LOCAL_DEMO_DATABASE_PORT") !== LOCAL_DEMO_PORT
  )
    throw new Error("The declared local demo database target is not approved.");
  const databaseUrl = targetFromUrl(
    required(environment, "DATABASE_URL"),
    "DATABASE_URL",
  );
  const directUrl = targetFromUrl(
    required(environment, "DIRECT_URL"),
    "DIRECT_URL",
  );
  for (const target of [databaseUrl, directUrl]) {
    if (
      target.host !== LOCAL_DEMO_HOST ||
      target.port !== LOCAL_DEMO_PORT ||
      target.database !== LOCAL_DEMO_DATABASE_NAME ||
      target.schema !== "public" ||
      target.applicationName !== LOCAL_DEMO_APPLICATION_NAME
    )
      throw new Error(
        "Local demo URLs must target exactly 127.0.0.1:5435/advisio_demo_local with the approved application name.",
      );
  }
  if (databaseUrl.normalized !== directUrl.normalized)
    throw new Error("DATABASE_URL and DIRECT_URL must match exactly.");
  if (environment.STORAGE_PROVIDER !== "LOCAL")
    throw new Error("Local demo fixtures require STORAGE_PROVIDER=LOCAL.");
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
  ])
    if (environment[name]?.trim())
      throw new Error(`${name} must be empty for local demo commands.`);
  return databaseUrl;
}

export async function verifyLocalDemoTarget(
  client: Pick<PrismaClient, "$queryRawUnsafe"> = prisma,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const target = validateLocalDemoEnvironment(environment);
  const rows = await client.$queryRawUnsafe<DatabaseIdentity[]>(`
    SELECT current_database() AS "databaseName",
      current_user AS "databaseUser",
      current_schema() AS "schemaName",
      current_setting('application_name') AS "applicationName",
      pg_is_in_recovery() AS "isReplica"
  `);
  const identity = rows[0];
  if (
    !identity ||
    identity.databaseName !== LOCAL_DEMO_DATABASE_NAME ||
    identity.databaseUser !== target.user ||
    identity.schemaName !== "public" ||
    identity.applicationName !== LOCAL_DEMO_APPLICATION_NAME ||
    identity.isReplica
  )
    throw new Error(
      "The live PostgreSQL identity does not match the approved writable local demo database.",
    );
  return identity;
}

function privatePath(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(repositoryRoot, value);
}

function credentialFilePath(environment: NodeJS.ProcessEnv = process.env) {
  return privatePath(required(environment, "LOCAL_DEMO_CREDENTIALS_FILE"));
}

function strongPassword() {
  return `${crypto.randomBytes(24).toString("base64url")}Aa1!`;
}

function isStrongPassword(value: string) {
  return (
    value.length >= 24 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

async function generateCredentials() {
  validateLocalDemoEnvironment();
  const file = credentialFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload: CredentialFile = {
    format: CREDENTIAL_FORMAT,
    datasetId: LOCAL_DEMO_DATASET_ID,
    generatedAt: new Date().toISOString(),
    accounts: LOCAL_DEMO_ACCOUNTS.map((account) => ({
      key: account.key,
      email: account.email,
      password: strongPassword(),
      role: account.role,
      status: account.status,
      collegeCode: account.collegeCode,
      programCode: account.programCode,
    })),
  };
  try {
    await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      `Generated ${payload.accounts.length} private account credentials in ${file}. Passwords were not printed.`,
    );
  } catch (error: any) {
    if (error?.code !== "EEXIST") throw error;
    await readCredentials();
    console.log(`Reusing the existing validated credential file at ${file}.`);
  }
}

async function readCredentials(): Promise<CredentialFile> {
  const parsed = JSON.parse(
    await fs.readFile(credentialFilePath(), "utf8"),
  ) as CredentialFile;
  if (
    parsed.format !== CREDENTIAL_FORMAT ||
    parsed.datasetId !== LOCAL_DEMO_DATASET_ID ||
    !Array.isArray(parsed.accounts) ||
    parsed.accounts.length !== LOCAL_DEMO_ACCOUNTS.length
  )
    throw new Error(
      "The local demo credential file has the wrong format, dataset, or account count.",
    );
  for (const definition of LOCAL_DEMO_ACCOUNTS) {
    const credential = parsed.accounts.find(
      (item) => item.key === definition.key,
    );
    if (
      !credential ||
      credential.email !== definition.email ||
      credential.role !== definition.role ||
      credential.status !== definition.status ||
      credential.collegeCode !== definition.collegeCode ||
      credential.programCode !== definition.programCode ||
      !isStrongPassword(credential.password)
    )
      throw new Error(`Credential validation failed for ${definition.key}.`);
  }
  return parsed;
}

function accountKeyForProgram(collegeCode: string, programCode: string) {
  return `program:${collegeCode}:${programCode}`;
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function escapePdf(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createSimplePdf(title: string, body: string) {
  const text = `BT /F1 18 Tf 72 720 Td (${escapePdf(title)}) Tj 0 -34 Td /F1 11 Tf (${escapePdf(body)}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function fixtureStorageDirectory() {
  return path.resolve(
    repositoryRoot,
    "apps/api/uploads/local",
    LOCAL_DEMO_DATASET_ID.toLowerCase(),
  );
}

function assertFixtureStoragePath(value: string) {
  const root = fixtureStorageDirectory();
  const target = path.resolve(value);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Error(
      "Refusing a local demo file path outside its exact fixture directory.",
    );
  return target;
}

async function prepareFixtureFiles() {
  const directory = fixtureStorageDirectory();
  await fs.mkdir(directory, { recursive: true });
  const result = new Map<
    string,
    { path: string; buffer: Buffer; checksum: string }[]
  >();
  for (const definition of projectDefinitions) {
    const files = [];
    for (let version = 1; version <= definition.versions; version += 1) {
      const buffer = createSimplePdf(
        `${definition.programCode} fictional manuscript v${version}`,
        `${definition.title}. Local demonstration material only; it contains no external document identity.`,
      );
      const target = assertFixtureStoragePath(
        path.join(
          directory,
          `${definition.key.toLowerCase()}-manuscript-v${version}.pdf`,
        ),
      );
      await fs.writeFile(target, buffer, { flag: "wx" });
      files.push({
        path: target,
        buffer,
        checksum: crypto.createHash("sha256").update(buffer).digest("hex"),
      });
    }
    result.set(definition.key, files);
  }
  return result;
}

async function removeFixtureFiles() {
  const directory = fixtureStorageDirectory();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(directory);
  } catch (error: any) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  const expected = new Set(
    projectDefinitions.flatMap((definition) =>
      Array.from(
        { length: definition.versions },
        (_, index) =>
          `${definition.key.toLowerCase()}-manuscript-v${index + 1}.pdf`,
      ),
    ),
  );
  const unexpected = entries.filter((entry) => !expected.has(entry));
  if (unexpected.length)
    throw new Error(
      `Refusing to remove the fixture directory because it contains unexpected files: ${unexpected.join(", ")}`,
    );
  for (const entry of entries)
    await fs.rm(assertFixtureStoragePath(path.join(directory, entry)));
  await fs.rmdir(directory).catch((error: any) => {
    if (error?.code !== "ENOENT") throw error;
  });
}

async function seedLocalDemo() {
  const identity = await verifyLocalDemoTarget();
  const credentials = await readCredentials();
  const existingRoots = await prisma.$transaction([
    prisma.user.count({
      where: { email: { in: LOCAL_DEMO_ACCOUNTS.map((item) => item.email) } },
    }),
    prisma.researchProject.count({
      where: {
        groupName: { in: projectDefinitions.map((item) => item.groupName) },
      },
    }),
    prisma.auditLog.count({
      where: {
        entityType: "LocalDemoDataset",
        entityId: LOCAL_DEMO_DATASET_UUID,
      },
    }),
  ]);
  if (existingRoots.some(Boolean))
    throw new Error(
      "The exact local demo dataset already exists. Use npm run demo:local:reset instead of reseeding it.",
    );

  await seedReferenceData(prisma);
  const [roles, colleges, programs] = await Promise.all([
    prisma.role.findMany({ where: { name: { in: REQUIRED_ROLES } } }),
    prisma.college.findMany({
      where: { code: { in: [...REQUIRED_COLLEGES] } },
    }),
    prisma.program.findMany({ include: { college: true } }),
  ]);
  if (
    roles.length !== REQUIRED_ROLES.length ||
    colleges.length !== REQUIRED_COLLEGES.length ||
    programs.length !== VERIFIED_PROGRAMS.length
  )
    throw new Error(
      "Institutional reference data is incomplete; no local demo identities were created.",
    );

  const roleByName = new Map(roles.map((role) => [role.name, role.id]));
  const collegeByCode = new Map(
    colleges.map((college) => [college.code, college.id]),
  );
  const programByKey = new Map(
    programs.map((program) => [
      programCatalogKey(program.college.code, program.code),
      program,
    ]),
  );
  const credentialByKey = new Map(
    credentials.accounts.map((item) => [item.key, item]),
  );
  const passwordHashes = new Map(
    await Promise.all(
      credentials.accounts.map(
        async (item) =>
          [item.key, await bcrypt.hash(item.password, 12)] as const,
      ),
    ),
  );
  let files: Awaited<ReturnType<typeof prepareFixtureFiles>> | null = null;
  try {
    const fixtureFiles = await prepareFixtureFiles();
    files = fixtureFiles;
    await prisma.$transaction(
      async (tx) => {
        const academicYear = await tx.academicYear.upsert({
          where: { name: "2026-2027" },
          update: {
            startDate: new Date("2026-08-01"),
            endDate: new Date("2027-06-30"),
            isCurrent: true,
            isActive: true,
          },
          create: {
            name: "2026-2027",
            startDate: new Date("2026-08-01"),
            endDate: new Date("2027-06-30"),
            isCurrent: true,
            isActive: true,
          },
        });
        const users = new Map<string, { id: string }>();
        for (const account of LOCAL_DEMO_ACCOUNTS) {
          const program =
            account.programCode && account.collegeCode
              ? programByKey.get(
                  programCatalogKey(account.collegeCode, account.programCode),
                )
              : undefined;
          const user = await tx.user.create({
            data: {
              universityId: account.universityId,
              email: account.email,
              firstName: account.firstName,
              lastName: account.lastName,
              passwordHash: passwordHashes.get(account.key)!,
              status: account.status,
              collegeId:
                program?.collegeId ||
                (account.collegeCode
                  ? collegeByCode.get(account.collegeCode)
                  : undefined),
              programId: program?.id,
              appearancePreference: "SYSTEM",
              colorThemePreference:
                account.role === "SYSTEM_ADMIN"
                  ? "DEFAULT_ADVISIO"
                  : "COLLEGE_PROGRAM",
              roles: { create: { roleId: roleByName.get(account.role)! } },
            },
          });
          users.set(account.key, user);
          if (account.faculty) {
            await tx.facultyProfile.create({
              data: {
                userId: user.id,
                academicTitle: "Faculty Member",
                facultyDesignation: account.role.replaceAll("_", " "),
                department:
                  account.collegeCode || "Institutional Administration",
                expertiseKeywords: account.programCode
                  ? [
                      ...researchInterestsForProgram(account.programCode).slice(
                        0,
                        3,
                      ),
                    ]
                  : ["research governance"],
                researchInterests: account.programCode
                  ? [
                      ...researchInterestsForProgram(account.programCode).slice(
                        0,
                        3,
                      ),
                    ]
                  : ["academic quality"],
              },
            });
          }
          if (account.role === "RESEARCHER") {
            const programCode = account.programCode || "BSIT";
            await tx.researcherProfile.create({
              data: {
                userId: user.id,
                academicYearId: academicYear.id,
                degreeLevel: "UNDERGRADUATE",
                yearLevel: "YEAR_4",
                academicTerm: "FIRST_SEMESTER",
                researchStatus:
                  account.cohort === "onboarding"
                    ? "PREPARING_PROPOSAL"
                    : "HAS_PROJECT",
                groupSetup:
                  account.cohort === "onboarding"
                    ? "SET_UP_LATER"
                    : "INDIVIDUAL",
                tentativeTitle:
                  account.cohort === "onboarding"
                    ? `Exploratory ${programCode} research topic`
                    : undefined,
                researchType: "INDIVIDUAL",
                interests: [
                  ...researchInterestsForProgram(programCode).slice(0, 3),
                ],
                status: "SUBMITTED",
                submittedAt: new Date(),
              },
            });
          }
        }

        const adviser = users.get("role:adviser")!;
        const professor = users.get("role:professor")!;
        const panelists = [
          users.get("role:panelist")!,
          users.get("role:panelist-2")!,
          users.get("role:panelist-3")!,
        ];
        const dean = users.get("role:dean")!;
        const projectIds: string[] = [];

        for (const definition of projectDefinitions) {
          const program = programByKey.get(
            programCatalogKey(definition.collegeCode, definition.programCode),
          )!;
          const owner =
            definition.key === "BSIT"
              ? users.get("role:student")!
              : users.get(
                  accountKeyForProgram(
                    definition.collegeCode,
                    definition.programCode,
                  ),
                )!;
          const researchType = await tx.researchType.create({
            data: {
              programId: program.id,
              code: `LOCAL-DEMO-${definition.programCode}`,
              name: `${definition.programCode} Local Demo Research`,
              description: `${LOCAL_DEMO_DATASET_ID} fictional local research type`,
            },
          });
          const workflow = await tx.workflow.create({
            data: {
              researchTypeId: researchType.id,
              name: `${LOCAL_DEMO_DATASET_ID} ${definition.programCode} Workflow`,
              description:
                "Seven-stage local demonstration workflow using only fictional data.",
              version: 1,
              status: "PUBLISHED",
              createdBy: professor.id,
              publishedAt: new Date(),
            },
          });
          await tx.researchType.update({
            where: { id: researchType.id },
            data: { workflowId: workflow.id },
          });
          const stageDefinitions: Array<
            [number, string, InstitutionalRole, boolean]
          > = [
            [1, "Topic Proposal", "RESEARCHER", true],
            [2, "Adviser Review and Endorsement", "ADVISER", true],
            [3, "Proposal Defense", "PANELIST", true],
            [4, "Ethics Readiness", "REB", false],
            [5, "Implementation and Manuscript Revision", "RESEARCHER", true],
            [6, "Final Oral Defense", "PANELIST", true],
            [7, "Final Manuscript Approval and Archiving", "RPO", true],
          ];
          const stages = [];
          const tasks = [];
          for (const [
            sequence,
            name,
            responsibleRole,
            requiresDocument,
          ] of stageDefinitions) {
            const stage = await tx.workflowStage.create({
              data: {
                workflowId: workflow.id,
                name,
                description: `${LOCAL_DEMO_DATASET_ID}: ${name}`,
                sequence,
                responsibleRoleId: roleByName.get(responsibleRole)!,
                requiresApproval: true,
                requiresDocument,
                deadlineDays: sequence * 14,
                isFinal: sequence === 7,
                submissionMode: "TASK",
              },
            });
            stages.push(stage);
            tasks.push(
              await tx.workflowTask.create({
                data: {
                  stageId: stage.id,
                  title: `${name} deliverable`,
                  instructions:
                    "Submit fictional local-only demonstration material.",
                  sequence: 1,
                  dueDays: 14,
                  isRequired: requiresDocument,
                },
              }),
            );
          }
          const project = await tx.researchProject.create({
            data: {
              researchTypeId: researchType.id,
              programId: program.id,
              collegeId: program.collegeId,
              academicYearId: academicYear.id,
              title: definition.title,
              groupName: definition.groupName,
              participationMode: "GROUP",
              accessMode: "INVITE_ONLY",
              abstract:
                "A fictional study created only for local Advisio development and UI testing.",
              status: definition.status,
              createdBy: owner.id,
              completedAt:
                definition.status === "COMPLETED" ? addDays(-14) : undefined,
            },
          });
          projectIds.push(project.id);
          const instance = await tx.workflowInstance.create({
            data: {
              researchId: project.id,
              workflowId: workflow.id,
              workflowVersion: 1,
              currentStageId: stages[definition.currentStage - 1].id,
              completedAt:
                definition.status === "COMPLETED" ? addDays(-14) : undefined,
            },
          });
          await tx.researchProject.update({
            where: { id: project.id },
            data: { workflowInstanceId: instance.id },
          });
          await tx.workflowEnrollment.create({
            data: { workflowId: workflow.id, userId: owner.id },
          });
          await tx.researchMember.createMany({
            data: [
              {
                researchId: project.id,
                userId: owner.id,
                projectRole: "LEADER",
              },
              {
                researchId: project.id,
                userId: adviser.id,
                projectRole: "ADVISER",
              },
              {
                researchId: project.id,
                userId: professor.id,
                projectRole: "COORDINATOR",
              },
              ...panelists.map((panelist) => ({
                researchId: project.id,
                userId: panelist.id,
                projectRole: "PANELIST" as const,
              })),
            ],
          });
          await tx.adviserRequest.create({
            data: {
              researchId: project.id,
              adviserId: adviser.id,
              requestedById: owner.id,
              status: "ACCEPTED",
              note: "Fictional request for local demonstration advising.",
              responseNote: "Accepted for local workflow testing.",
              respondedAt: addDays(-45),
            },
          });

          for (const [index, consultationStatus] of (
            ["COMPLETED", "SCHEDULED"] as const
          ).entries()) {
            const consultation = await tx.consultation.create({
              data: {
                researchId: project.id,
                createdBy: owner.id,
                title:
                  index === 0
                    ? "Scope and methodology review"
                    : "Next milestone planning",
                description:
                  "Fictional adviser consultation for local development testing.",
                scheduledStart: index === 0 ? addDays(-21) : addDays(4),
                scheduledEnd:
                  index === 0 ? addDays(-21 + 1 / 24) : addDays(4 + 1 / 24),
                status: consultationStatus,
                legacyImportKey: `${LOCAL_DEMO_DATASET_ID}:${definition.key}:CONSULTATION:${index + 1}`,
              },
            });
            await tx.consultationParticipant.createMany({
              data: [
                {
                  consultationId: consultation.id,
                  userId: owner.id,
                  attendanceStatus: index === 0 ? "JOINED" : "ACCEPTED",
                },
                {
                  consultationId: consultation.id,
                  userId: adviser.id,
                  attendanceStatus: index === 0 ? "JOINED" : "ACCEPTED",
                },
              ],
            });
            if (index === 0)
              await tx.consultationNote.create({
                data: {
                  consultationId: consultation.id,
                  authorId: adviser.id,
                  notes:
                    "Clarify the sampling plan and connect each objective to a measurable outcome.",
                  actionItems: [
                    {
                      owner: "researcher",
                      item: "Revise the methodology section",
                    },
                  ],
                },
              });
          }

          const preparedFiles = fixtureFiles.get(definition.key)!;
          const document = await tx.document.create({
            data: {
              researchId: project.id,
              milestoneId: stages[0].id,
              documentType: `TASK_${tasks[0].id}`,
              title: `${definition.programCode} Fictional Manuscript`,
              currentVersion: definition.versions,
              storageProvider: "LOCAL",
              externalFileId: null,
              lifecycleStatus: definition.documentLifecycle,
              creationKey: `${LOCAL_DEMO_DATASET_ID}:${definition.key}:DOCUMENT`,
              createdBy: owner.id,
            },
          });
          const versions = [];
          for (let index = 0; index < preparedFiles.length; index += 1) {
            const prepared = preparedFiles[index];
            const isLatest = index === preparedFiles.length - 1;
            versions.push(
              await tx.documentVersion.create({
                data: {
                  documentId: document.id,
                  versionNumber: index + 1,
                  fileName: `${definition.programCode.toLowerCase()}-fictional-manuscript-v${index + 1}.pdf`,
                  mimeType: "application/pdf",
                  fileSize: BigInt(prepared.buffer.length),
                  storagePath: prepared.path,
                  googleDriveFileId: null,
                  uploadedBy: owner.id,
                  status: isLatest ? "ACTIVE" : "SUPERSEDED",
                  manuscriptStatus: isLatest
                    ? definition.documentLifecycle
                    : "REVISION_REQUIRED",
                  isImmutable: false,
                  contentChecksum: prepared.checksum,
                  submittedBy: owner.id,
                  submittedAt: addDays(-30 + index * 7),
                  milestoneId: stages[0].id,
                },
              }),
            );
          }
          const latestVersion = versions.at(-1)!;
          const submission = await tx.taskSubmission.create({
            data: {
              researchId: project.id,
              taskId: tasks[0].id,
              documentId: document.id,
              documentVersionId: latestVersion.id,
              submittedBy: owner.id,
              status: definition.taskStatus,
              note: "Fictional local demonstration submission.",
              reviewNote:
                definition.key === "BSIT"
                  ? "Revision received and returned to review."
                  : undefined,
              submittedAt: addDays(-20),
              reviewedAt:
                definition.taskStatus === "APPROVED" ? addDays(-18) : undefined,
            },
          });
          for (let index = 0; index < versions.length; index += 1) {
            await tx.taskSubmissionAttempt.create({
              data: {
                taskSubmissionId: submission.id,
                researchId: project.id,
                taskId: tasks[0].id,
                milestoneId: stages[0].id,
                documentId: document.id,
                documentVersionId: versions[index].id,
                attemptNumber: index + 1,
                submittedBy: owner.id,
                status:
                  index < versions.length - 1
                    ? "REVISION_REQUIRED"
                    : definition.taskStatus,
                note: `Fictional submission attempt ${index + 1}.`,
                reviewNote:
                  index < versions.length - 1
                    ? "Strengthen the evidence and revise the methodology."
                    : undefined,
                submittedAt: addDays(-30 + index * 7),
                reviewedAt:
                  index < versions.length - 1 ||
                  definition.taskStatus === "APPROVED"
                    ? addDays(-28 + index * 7)
                    : undefined,
              },
            });
          }
          await tx.manuscriptStatusEvent.create({
            data: {
              documentId: document.id,
              versionId: latestVersion.id,
              fromStatus: "DRAFT",
              toStatus: definition.documentLifecycle,
              actorId: owner.id,
              reason: "Seeded local-only workflow state.",
              metadata: {
                datasetId: LOCAL_DEMO_DATASET_ID,
                immutableSnapshot: false,
              },
            },
          });
          const assignment = await tx.reviewerAssignment.create({
            data: {
              researchId: project.id,
              documentId: document.id,
              documentVersionId: latestVersion.id,
              reviewerId: adviser.id,
              reviewType: "ADVISER",
              assignedById: professor.id,
              status:
                definition.reviewStatus === "DRAFT" ? "ACTIVE" : "COMPLETED",
              completedAt:
                definition.reviewStatus === "DRAFT" ? undefined : addDays(-16),
            },
          });
          await tx.reviewerAssignmentEvent.create({
            data: {
              assignmentId: assignment.id,
              action: "ASSIGNED",
              actorId: professor.id,
              details: { datasetId: LOCAL_DEMO_DATASET_ID },
            },
          });
          const review = await tx.review.create({
            data: {
              assignmentId: assignment.id,
              documentVersionId: latestVersion.id,
              documentId: document.id,
              reviewerId: adviser.id,
              reviewType: "ADVISER",
              overallComment:
                definition.reviewStatus === "DRAFT"
                  ? "Draft review in progress."
                  : "The submission was reviewed in the fictional local workflow.",
              recommendation: definition.recommendation,
              status: definition.reviewStatus,
              submittedAt:
                definition.reviewStatus === "SUBMITTED"
                  ? addDays(-16)
                  : undefined,
            },
          });
          await tx.reviewComment.create({
            data: {
              reviewId: review.id,
              documentVersionId: latestVersion.id,
              authorId: adviser.id,
              comment:
                definition.key === "BSIT"
                  ? "Explain how alert thresholds are validated."
                  : "Keep the discussion aligned with the stated objectives.",
              locationData: { page: 2, source: "local-demo" },
              status: definition.key === "BSHM" ? "RESOLVED" : "OPEN",
              resolvedAt: definition.key === "BSHM" ? addDays(-17) : undefined,
            },
          });

          const event = await tx.defenseEvent.create({
            data: {
              code: `LD26-${definition.programCode}`,
              collegeId: program.collegeId,
              defenseType:
                definition.currentStage >= 6
                  ? "FINAL_DEFENSE"
                  : "PROPOSAL_DEFENSE",
              status:
                definition.defenseStatus === "COMPLETED"
                  ? "COMPLETED"
                  : "READY",
              scheduledStart:
                definition.defenseStatus === "COMPLETED"
                  ? addDays(-14)
                  : addDays(10),
              scheduledEnd:
                definition.defenseStatus === "COMPLETED"
                  ? addDays(-14 + 2 / 24)
                  : addDays(10 + 2 / 24),
              venue: "Advisio Local Demo Room",
              notes: `${LOCAL_DEMO_DATASET_ID} fictional defense event`,
              createdBy: dean.id,
              startedAt:
                definition.defenseStatus === "COMPLETED"
                  ? addDays(-14)
                  : undefined,
              completedAt:
                definition.defenseStatus === "COMPLETED"
                  ? addDays(-14 + 2 / 24)
                  : undefined,
            },
          });
          const session = await tx.defenseSession.create({
            data: {
              researchId: project.id,
              defenseEventId: event.id,
              queuePosition: 1,
              queueStatus: definition.queueStatus,
              status: definition.defenseStatus,
              decision:
                definition.defenseStatus === "COMPLETED"
                  ? "APPROVED_WITH_MINOR_REVISIONS"
                  : undefined,
              venue: "Advisio Local Demo Room",
              notes: `${definition.programCode} fictional defense workflow`,
              scheduledStart: event.scheduledStart,
              scheduledEnd: event.scheduledEnd,
              createdBy: dean.id,
              startedAt:
                definition.defenseStatus === "COMPLETED"
                  ? event.scheduledStart
                  : undefined,
              endedAt:
                definition.defenseStatus === "COMPLETED"
                  ? event.scheduledEnd
                  : undefined,
              releasedAt:
                definition.defenseStatus === "COMPLETED"
                  ? addDays(-13)
                  : undefined,
              releasedBy:
                definition.defenseStatus === "COMPLETED" ? dean.id : undefined,
            },
          });
          await tx.defenseInvitation.createMany({
            data: [
              {
                defenseSessionId: session.id,
                inviteeId: panelists[0].id,
                role: "PANEL_CHAIR",
                status: "ACCEPTED",
                respondedAt: addDays(-2),
              },
              {
                defenseSessionId: session.id,
                inviteeId: panelists[1].id,
                role: "PANELIST",
                status: definition.key === "BSIT" ? "PENDING" : "ACCEPTED",
                respondedAt:
                  definition.key === "BSIT" ? undefined : addDays(-2),
              },
              {
                defenseSessionId: session.id,
                inviteeId: panelists[2].id,
                role: "PANELIST",
                status: "ACCEPTED",
                respondedAt: addDays(-2),
              },
              {
                defenseSessionId: session.id,
                inviteeId: adviser.id,
                role: "ADVISER",
                status: "ACCEPTED",
                respondedAt: addDays(-2),
              },
            ],
          });
          const evaluationTemplate = await tx.evaluationTemplate.create({
            data: {
              name: `${LOCAL_DEMO_DATASET_ID} ${definition.programCode} Defense Rubric`,
              researchTypeId: researchType.id,
              version: 1,
              totalScore: 100,
              criteria: {
                create: [
                  {
                    criterion: "Research quality",
                    maxScore: 40,
                    weight: 1,
                    sequence: 1,
                  },
                  {
                    criterion: "Presentation and defense",
                    maxScore: 35,
                    weight: 1,
                    sequence: 2,
                  },
                  {
                    criterion: "Practical contribution",
                    maxScore: 25,
                    weight: 1,
                    sequence: 3,
                  },
                ],
              },
            },
          });
          if (definition.key !== "BSIT") {
            for (let index = 0; index < panelists.length; index += 1) {
              const locked = definition.key === "BSHM";
              const submitted = locked || index === 0;
              const scores = {
                researchQuality: 35 + index,
                presentation: 31 + index,
                contribution: 22 + index,
              };
              await tx.evaluation.create({
                data: {
                  templateId: evaluationTemplate.id,
                  researchId: project.id,
                  evaluatorId: panelists[index].id,
                  defenseSessionId: session.id,
                  status: locked ? "LOCKED" : submitted ? "SUBMITTED" : "DRAFT",
                  totalScore: submitted ? 88 + index : undefined,
                  recommendation: submitted ? "MINOR_REVISION" : undefined,
                  criteriaScores: scores,
                  remarks: submitted
                    ? "Fictional evaluation for local UI testing."
                    : "Evaluation draft in progress.",
                  integrityHash: locked
                    ? crypto
                        .createHash("sha256")
                        .update(JSON.stringify(scores))
                        .digest("hex")
                    : undefined,
                  lockedAt: locked ? addDays(-14) : undefined,
                  submittedAt: submitted ? addDays(-14) : undefined,
                },
              });
              await tx.panelistManuscriptReview.create({
                data: {
                  defenseSessionId: session.id,
                  panelistId: panelists[index].id,
                  privateNotes: "Fictional local manuscript review notes.",
                  annotations: [{ page: 3, note: "Clarify this result." }],
                  revisionChecklist: [
                    { item: "Address panel feedback", complete: locked },
                  ],
                  reviewedAt: submitted ? addDays(-15) : undefined,
                },
              });
            }
          }
        }

        await tx.auditLog.create({
          data: {
            userId: users.get("role:system-admin")!.id,
            action: "CREATE",
            entityType: "LocalDemoDataset",
            entityId: LOCAL_DEMO_DATASET_UUID,
            newValues: {
              datasetId: LOCAL_DEMO_DATASET_ID,
              database: identity.databaseName,
              accounts: LOCAL_DEMO_ACCOUNTS.length,
              projects: projectIds,
              externalStorageUsed: false,
              immutableSnapshotsFabricated: false,
            },
          },
        });
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    if (files) await removeFixtureFiles().catch(() => undefined);
    throw error;
  }
  console.log(
    `Created ${LOCAL_DEMO_DATASET_ID}: ${LOCAL_DEMO_ACCOUNTS.length} accounts, ${projectDefinitions.length} projects, and local-only document fixtures.`,
  );
}

async function collectFixtureRoots() {
  const [
    users,
    projects,
    workflows,
    researchTypes,
    evaluationTemplates,
    defenseEvents,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: LOCAL_DEMO_ACCOUNTS.map((item) => item.email) } },
      select: { id: true, email: true },
    }),
    prisma.researchProject.findMany({
      where: {
        groupName: { in: projectDefinitions.map((item) => item.groupName) },
      },
      select: {
        id: true,
        groupName: true,
        documents: { select: { versions: { select: { storagePath: true } } } },
      },
    }),
    prisma.workflow.findMany({
      where: {
        name: {
          in: projectDefinitions.map(
            (item) => `${LOCAL_DEMO_DATASET_ID} ${item.programCode} Workflow`,
          ),
        },
      },
      select: { id: true },
    }),
    prisma.researchType.findMany({
      where: {
        code: {
          in: projectDefinitions.map(
            (item) => `LOCAL-DEMO-${item.programCode}`,
          ),
        },
      },
      select: { id: true },
    }),
    prisma.evaluationTemplate.findMany({
      where: {
        name: {
          in: projectDefinitions.map(
            (item) =>
              `${LOCAL_DEMO_DATASET_ID} ${item.programCode} Defense Rubric`,
          ),
        },
      },
      select: { id: true },
    }),
    prisma.defenseEvent.findMany({
      where: {
        code: {
          in: projectDefinitions.map((item) => `LD26-${item.programCode}`),
        },
      },
      select: { id: true },
    }),
    prisma.auditLog.findMany({
      where: {
        entityType: "LocalDemoDataset",
        entityId: LOCAL_DEMO_DATASET_UUID,
      },
      select: { id: true },
    }),
  ]);
  return {
    users,
    projects,
    workflows,
    researchTypes,
    evaluationTemplates,
    defenseEvents,
    auditLogs,
  };
}

async function cleanupLocalDemo() {
  await verifyLocalDemoTarget();
  if (
    process.env.LOCAL_DEMO_CLEANUP_CONFIRMATION !==
    `DELETE:${LOCAL_DEMO_DATASET_ID}`
  )
    throw new Error(
      `Set LOCAL_DEMO_CLEANUP_CONFIRMATION=DELETE:${LOCAL_DEMO_DATASET_ID} to authorize exact cleanup.`,
    );
  const roots = await collectFixtureRoots();
  const userIds = roots.users.map((item) => item.id);
  const projectIds = roots.projects.map((item) => item.id);
  const workflowIds = roots.workflows.map((item) => item.id);
  const researchTypeIds = roots.researchTypes.map((item) => item.id);
  await prisma.$transaction(
    async (tx) => {
      if (userIds.length || projectIds.length)
        await tx.auditLog.deleteMany({
          where: {
            OR: [
              ...(userIds.length ? [{ userId: { in: userIds } }] : []),
              ...(projectIds.length ? [{ entityId: { in: projectIds } }] : []),
              {
                entityType: "LocalDemoDataset",
                entityId: LOCAL_DEMO_DATASET_UUID,
              },
            ],
          },
        });
      if (projectIds.length) {
        await tx.researchProject.updateMany({
          where: { id: { in: projectIds } },
          data: { workflowInstanceId: null },
        });
        await tx.workflowInstance.deleteMany({
          where: { researchId: { in: projectIds } },
        });
        await tx.researchProject.deleteMany({
          where: { id: { in: projectIds } },
        });
      }
      if (researchTypeIds.length)
        await tx.researchType.updateMany({
          where: { id: { in: researchTypeIds } },
          data: { workflowId: null },
        });
      if (roots.evaluationTemplates.length)
        await tx.evaluationTemplate.deleteMany({
          where: {
            id: { in: roots.evaluationTemplates.map((item) => item.id) },
          },
        });
      if (workflowIds.length)
        await tx.workflow.deleteMany({ where: { id: { in: workflowIds } } });
      if (researchTypeIds.length)
        await tx.researchType.deleteMany({
          where: { id: { in: researchTypeIds } },
        });
      if (roots.defenseEvents.length)
        await tx.defenseEvent.deleteMany({
          where: { id: { in: roots.defenseEvents.map((item) => item.id) } },
        });
      if (userIds.length) {
        await tx.facultyProfile.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }
    },
    { timeout: 60_000 },
  );
  await removeFixtureFiles();
  const remaining = await collectFixtureRoots();
  const remainingCount = Object.values(remaining).reduce(
    (sum, rows) => sum + rows.length,
    0,
  );
  if (remainingCount)
    throw new Error(
      `Cleanup left ${remainingCount} exact fixture root records.`,
    );
  console.log(
    `Removed only records and files belonging to ${LOCAL_DEMO_DATASET_ID}. Reference data and unrelated records were preserved.`,
  );
}

async function verifyLocalDemo() {
  const identity = await verifyLocalDemoTarget();
  const credentials = await readCredentials();
  const [roles, colleges, programs, users, projects] = await Promise.all([
    prisma.role.findMany({ where: { name: { in: REQUIRED_ROLES } } }),
    prisma.college.findMany({
      where: { code: { in: [...REQUIRED_COLLEGES] }, isActive: true },
    }),
    prisma.program.findMany({
      where: { isActive: true },
      include: { college: true },
    }),
    prisma.user.findMany({
      where: { email: { in: LOCAL_DEMO_ACCOUNTS.map((item) => item.email) } },
      include: { roles: { include: { role: true } }, researcherProfile: true },
    }),
    prisma.researchProject.findMany({
      where: {
        groupName: { in: projectDefinitions.map((item) => item.groupName) },
      },
      include: {
        members: true,
        consultations: true,
        workflowInstance: {
          include: {
            workflow: { include: { stages: { include: { tasks: true } } } },
          },
        },
        documents: {
          include: {
            versions: true,
            reviews: true,
            reviewerAssignments: true,
            taskSubmissions: { include: { attempts: true } },
          },
        },
        defenseSessions: {
          include: {
            invitations: true,
            evaluations: true,
            manuscriptReviews: true,
          },
        },
      },
    }),
  ]);
  if (roles.length !== 8 || colleges.length !== 9 || programs.length !== 20)
    throw new Error(
      `Reference verification failed: roles=${roles.length}, colleges=${colleges.length}, programs=${programs.length}.`,
    );
  if (users.length !== LOCAL_DEMO_ACCOUNTS.length)
    throw new Error(
      `Expected ${LOCAL_DEMO_ACCOUNTS.length} local demo accounts but found ${users.length}.`,
    );
  for (const definition of LOCAL_DEMO_ACCOUNTS) {
    const credential = credentials.accounts.find(
      (item) => item.key === definition.key,
    )!;
    const user = users.find((item) => item.email === definition.email);
    if (
      !user?.passwordHash ||
      user.status !== definition.status ||
      user.roles.length !== 1 ||
      user.roles[0].role.name !== definition.role
    )
      throw new Error(
        `Identity or role verification failed for ${definition.key}.`,
      );
    if (!(await bcrypt.compare(credential.password, user.passwordHash)))
      throw new Error(`Password verification failed for ${definition.key}.`);
    if (
      definition.role === "RESEARCHER" &&
      (!user.researcherProfile || user.researcherProfile.status !== "SUBMITTED")
    )
      throw new Error(
        `Researcher profile verification failed for ${definition.key}.`,
      );
    if (definition.role === "RESEARCHER") {
      const interests = user.researcherProfile?.interests;
      const allowed = new Set(
        researchInterestsForProgram(definition.programCode),
      );
      if (
        !Array.isArray(interests) ||
        interests.length === 0 ||
        interests.length > MAX_RESEARCH_INTERESTS ||
        interests.some(
          (interest) => typeof interest !== "string" || !allowed.has(interest),
        )
      )
        throw new Error(
          `Program-specific interest verification failed for ${definition.key}.`,
        );
    }
  }
  if (projects.length !== projectDefinitions.length)
    throw new Error(
      `Expected ${projectDefinitions.length} projects but found ${projects.length}.`,
    );
  for (const definition of projectDefinitions) {
    const project = projects.find(
      (item) => item.groupName === definition.groupName,
    );
    if (
      !project ||
      project.members.length !== 6 ||
      project.consultations.length !== 2
    )
      throw new Error(
        `Core fixture verification failed for ${definition.key}.`,
      );
    if (
      !project.workflowInstance ||
      project.workflowInstance.workflow.stages.length !== 7 ||
      project.workflowInstance.workflow.stages.some(
        (stage) => stage.tasks.length !== 1,
      )
    )
      throw new Error(`Milestone verification failed for ${definition.key}.`);
    if (
      project.documents.length !== 1 ||
      project.documents[0].versions.length !== definition.versions
    )
      throw new Error(
        `Document version verification failed for ${definition.key}.`,
      );
    const document = project.documents[0];
    if (
      document.storageProvider !== "LOCAL" ||
      document.externalFileId !== null ||
      document.versions.some(
        (version) => version.googleDriveFileId !== null || version.isImmutable,
      )
    )
      throw new Error(
        `External storage or immutable snapshot verification failed for ${definition.key}.`,
      );
    for (const version of document.versions) {
      assertFixtureStoragePath(version.storagePath);
      const bytes = await fs.readFile(version.storagePath);
      if (
        BigInt(bytes.length) !== version.fileSize ||
        crypto.createHash("sha256").update(bytes).digest("hex") !==
          version.contentChecksum
      )
        throw new Error(
          `Local document integrity verification failed for ${definition.key} v${version.versionNumber}.`,
        );
    }
    if (
      document.reviews.length !== 1 ||
      document.reviewerAssignments.length !== 1 ||
      document.taskSubmissions.length !== 1 ||
      document.taskSubmissions[0].attempts.length !== definition.versions
    )
      throw new Error(
        `Review workflow verification failed for ${definition.key}.`,
      );
    if (
      project.defenseSessions.length !== 1 ||
      project.defenseSessions[0].invitations.length !== 4
    )
      throw new Error(
        `Defense workflow verification failed for ${definition.key}.`,
      );
    if (
      definition.key === "BSTM" &&
      project.defenseSessions[0].evaluations.length !== 3
    )
      throw new Error("BSTM evaluation-state verification failed.");
    if (
      definition.key === "BSHM" &&
      (project.defenseSessions[0].evaluations.length !== 3 ||
        project.defenseSessions[0].evaluations.some(
          (evaluation) => evaluation.status !== "LOCKED",
        ))
    )
      throw new Error("BSHM locked evaluation verification failed.");
  }
  console.log(
    JSON.stringify(
      {
        database: identity.databaseName,
        applicationName: identity.applicationName,
        roles: roles.length,
        colleges: colleges.length,
        programs: programs.length,
        accounts: users.length,
        activeAccounts: users.filter((user) => user.status === "ACTIVE").length,
        pendingOnboardingAccounts: users.filter(
          (user) => user.status === "PENDING",
        ).length,
        projects: projects.length,
        documents: projects.reduce(
          (sum, project) => sum + project.documents.length,
          0,
        ),
        versions: projects.reduce(
          (sum, project) =>
            sum +
            project.documents.reduce(
              (subtotal, document) => subtotal + document.versions.length,
              0,
            ),
          0,
        ),
        defenses: projects.reduce(
          (sum, project) => sum + project.defenseSessions.length,
          0,
        ),
        externalStorageUsed: false,
        immutableSnapshotsFabricated: false,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const command = process.argv[2];
  if (command === "credentials") return generateCredentials();
  if (!["preflight", "seed", "verify", "cleanup"].includes(command || ""))
    throw new Error(
      "Usage: local-demo.js <credentials|preflight|seed|verify|cleanup>",
    );
  if (command === "preflight") {
    const identity = await verifyLocalDemoTarget();
    console.log(
      `Verified ${identity.databaseName} as ${identity.databaseUser} with application ${identity.applicationName}.`,
    );
    return;
  }
  if (command === "seed") return seedLocalDemo();
  if (command === "verify") return verifyLocalDemo();
  return cleanupLocalDemo();
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
