import { PrismaClient, type InstitutionalRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const PANEL_EMAIL_DOMAIN = "panel-demo.invalid";
const APPLICATION_NAME = "advisio-panel-demo";
const STAGING_DATABASE_NAME = "advisio_staging";
const REQUIRED_ROLE_NAMES: InstitutionalRole[] = [
  "RESEARCHER",
  "ADVISER",
  "RESEARCH_COORDINATOR",
  "PANELIST",
  "RPO",
  "SYSTEM_ADMIN",
];
const REQUIRED_COLLEGE_CODES = [
  "COA",
  "CEA",
  "CHTM",
  "CNP",
  "SAS",
  "SBPA",
  "SOE",
  "SHS",
  "CIT",
];

type CredentialRecord = { key: string; email: string; password: string };
type CredentialFile = {
  format: "advisio-panel-demo-credentials-v1";
  runId: string;
  createdAt: string;
  credentials: CredentialRecord[];
};
type DatabaseIdentity = {
  databaseName: string;
  databaseUser: string;
  schemaName: string;
  applicationName: string;
  isReplica: boolean;
};
type VerifiedContext = {
  marker: string;
  dryRun: boolean;
  academicYear: { id: string; name: string };
  college: { id: string; code: string };
  program: { id: string; code: string };
  systemAdministrator: { id: string; email: string };
};

const accountDefinitions: Array<{
  key: string;
  universitySuffix: string;
  firstName: string;
  lastName: string;
  role: InstitutionalRole;
  faculty?: boolean;
}> = [
  {
    key: "student",
    universitySuffix: "STUDENT",
    firstName: "Mika",
    lastName: "Reyes",
    role: "RESEARCHER",
  },
  {
    key: "adviser",
    universitySuffix: "ADVISER",
    firstName: "Elena",
    lastName: "Navarro",
    role: "ADVISER",
    faculty: true,
  },
  {
    key: "coordinator",
    universitySuffix: "COORDINATOR",
    firstName: "Paolo",
    lastName: "Villanueva",
    role: "RESEARCH_COORDINATOR",
    faculty: true,
  },
  {
    key: "panel-chair",
    universitySuffix: "PANEL-CHAIR",
    firstName: "Marisol",
    lastName: "Cruz",
    role: "PANELIST",
    faculty: true,
  },
  {
    key: "panelist-2",
    universitySuffix: "PANEL-2",
    firstName: "Victor",
    lastName: "Santos",
    role: "PANELIST",
    faculty: true,
  },
  {
    key: "panelist-3",
    universitySuffix: "PANEL-3",
    firstName: "Lina",
    lastName: "Torres",
    role: "PANELIST",
    faculty: true,
  },
  {
    key: "rpo",
    universitySuffix: "RPO",
    firstName: "Aurelia",
    lastName: "Mendoza",
    role: "RPO",
    faculty: true,
  },
];

function requiredFrom(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function markerFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const marker = requiredFrom(environment, "PANEL_DEMO_RUN_ID").toUpperCase();
  if (!/^PANEL-DEMO-[A-Z0-9-]{8,70}$/.test(marker))
    throw new Error(
      "PANEL_DEMO_RUN_ID must use the form PANEL-DEMO-<unique-run-id>.",
    );
  return marker;
}

function accountEmail(marker: string, key: string): string {
  return `${key}.${marker.toLowerCase()}@${PANEL_EMAIL_DOMAIN}`;
}
function accountUniversityId(marker: string, suffix: string): string {
  return `${marker}-${suffix}`.slice(0, 50);
}

function targetFromUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL.`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error(`${label} must be a PostgreSQL URL.`);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!databaseName) throw new Error(`${label} must include a database name.`);
  return {
    hostname: url.hostname.toLowerCase(),
    port: url.port || "5432",
    username: decodeURIComponent(url.username),
    databaseName,
    schema: url.searchParams.get("schema") || "public",
    applicationName: url.searchParams.get("application_name"),
  };
}

function sameTarget(
  left: ReturnType<typeof targetFromUrl>,
  right: ReturnType<typeof targetFromUrl>,
) {
  return (
    left.hostname === right.hostname &&
    left.port === right.port &&
    left.username === right.username &&
    left.databaseName === right.databaseName &&
    left.schema === right.schema
  );
}

export async function verifyPanelDemoTarget(
  client: any = prisma,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<VerifiedContext> {
  if (environment.NODE_ENV !== "staging")
    throw new Error(
      "Panel-demo commands require NODE_ENV=staging for this one-time process only.",
    );
  if (environment.PANEL_DEMO_EXECUTION !== "1")
    throw new Error(
      "Set PANEL_DEMO_EXECUTION=1 to authorize a panel-demo command.",
    );
  if (
    environment.ALLOW_DEMO_ACCOUNT_PROVISIONING === "true" ||
    environment.ALLOW_THEME_DEMO_ACCOUNTS === "true"
  )
    throw new Error(
      "Panel-demo commands refuse to run while general demo-account provisioning is enabled.",
    );
  const marker = markerFromEnvironment(environment);
  const expectedName = requiredFrom(environment, "PANEL_DEMO_DATABASE_NAME");
  if (expectedName !== STAGING_DATABASE_NAME)
    throw new Error(
      `Panel-demo staging commands only allow the dedicated ${STAGING_DATABASE_NAME} database.`,
    );
  const expectedHost = requiredFrom(
    environment,
    "PANEL_DEMO_DATABASE_HOST",
  ).toLowerCase();
  const panelUrl = targetFromUrl(
    requiredFrom(environment, "PANEL_DEMO_DATABASE_URL"),
    "PANEL_DEMO_DATABASE_URL",
  );
  const databaseUrl = targetFromUrl(
    requiredFrom(environment, "DATABASE_URL"),
    "DATABASE_URL",
  );
  const directUrl = targetFromUrl(
    requiredFrom(environment, "DIRECT_URL"),
    "DIRECT_URL",
  );
  if (
    panelUrl.databaseName !== expectedName ||
    panelUrl.hostname !== expectedHost ||
    panelUrl.schema !== "public" ||
    panelUrl.applicationName !== APPLICATION_NAME
  )
    throw new Error(
      "PANEL_DEMO_DATABASE_URL must name the declared staging host/database, public schema, and advisio-panel-demo application.",
    );
  if (!sameTarget(panelUrl, databaseUrl) || !sameTarget(panelUrl, directUrl))
    throw new Error(
      "DATABASE_URL and DIRECT_URL must exactly match PANEL_DEMO_DATABASE_URL for this command.",
    );
  const rows = (await client.$queryRawUnsafe(
    `SELECT current_database() AS "databaseName", current_user AS "databaseUser", current_schema() AS "schemaName", current_setting('application_name') AS "applicationName", pg_is_in_recovery() AS "isReplica"`,
  )) as DatabaseIdentity[];
  const identity = rows[0];
  if (
    !identity ||
    identity.databaseName !== expectedName ||
    identity.databaseUser !== panelUrl.username ||
    identity.schemaName !== "public" ||
    identity.applicationName !== APPLICATION_NAME ||
    identity.isReplica
  )
    throw new Error(
      "The live connection does not match the declared writable panel-demo staging database.",
    );
  const [
    roles,
    colleges,
    programs,
    years,
    users,
    projects,
    workflows,
    researchTypes,
  ] = await Promise.all([
    client.role.findMany({
      where: { name: { in: REQUIRED_ROLE_NAMES } },
      select: { id: true, name: true },
    }),
    client.college.findMany({
      where: { code: { in: REQUIRED_COLLEGE_CODES }, isActive: true },
      select: { id: true, code: true },
    }),
    client.program.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        collegeId: true,
        college: { select: { code: true } },
      },
    }),
    client.academicYear.findMany({
      where: { isActive: true, isCurrent: true },
      select: { id: true, name: true },
    }),
    client.user.findMany({
      select: {
        id: true,
        email: true,
        universityId: true,
        roles: { select: { role: { select: { name: true } } } },
      },
    }),
    client.researchProject.findMany({ select: { id: true, groupName: true } }),
    client.workflow.findMany({ select: { id: true, name: true } }),
    client.researchType.findMany({ select: { id: true, code: true } }),
  ]);
  if (roles.length !== REQUIRED_ROLE_NAMES.length)
    throw new Error(
      "Required institutional roles are missing; run the reference-data seed first.",
    );
  const program = programs.find(
    (item: any) => item.code === "BSIT" && item.college.code === "CIT",
  );
  if (
    colleges.length !== REQUIRED_COLLEGE_CODES.length ||
    programs.length < 20 ||
    !program
  )
    throw new Error(
      "The approved college/program reference catalog is incomplete; no panel data was created.",
    );
  if (years.length !== 1)
    throw new Error(
      "Exactly one active current Academic Year is required; panel onboarding will not bypass this configuration.",
    );
  const adminEmail = requiredFrom(
    environment,
    "PANEL_DEMO_ADMIN_EMAIL",
  ).toLowerCase();
  const administrator = users.find((user: any) => user.email === adminEmail);
  if (
    !administrator ||
    !administrator.roles.some(
      (assignment: any) => assignment.role.name === "SYSTEM_ADMIN",
    )
  )
    throw new Error(
      "PANEL_DEMO_ADMIN_EMAIL must identify the existing bootstrapped SYSTEM_ADMIN account.",
    );
  const markerUsers = users.filter((user: any) =>
    user.universityId.startsWith(marker),
  );
  const unexpectedUsers = users.filter(
    (user: any) => user.id !== administrator.id && !markerUsers.includes(user),
  );
  if (unexpectedUsers.length)
    throw new Error(
      "Unexpected user records are present; refusing to mix panel data with an unreviewed staging database.",
    );
  if (
    projects.some((project: any) => project.groupName !== marker) ||
    workflows.some((workflow: any) => !workflow.name.startsWith(marker)) ||
    researchTypes.some(
      (researchType: any) => !researchType.code.startsWith(marker),
    )
  )
    throw new Error(
      "Existing projects, workflows, or research types are present; refusing to create panel data.",
    );
  return {
    marker,
    dryRun: environment.PANEL_DEMO_DRY_RUN === "1",
    academicYear: years[0],
    college: colleges.find((college: any) => college.code === "CIT")!,
    program,
    systemAdministrator: { id: administrator.id, email: administrator.email },
  };
}

function isStrongPassword(password: string) {
  return (
    password.length >= 20 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

async function readCredentials(marker: string): Promise<CredentialFile> {
  const file = path.resolve(
    requiredFrom(process.env, "PANEL_DEMO_CREDENTIALS_FILE"),
  );
  const parsed = JSON.parse(await fs.readFile(file, "utf8")) as CredentialFile;
  if (
    parsed.format !== "advisio-panel-demo-credentials-v1" ||
    parsed.runId !== marker ||
    parsed.credentials.length !== accountDefinitions.length
  )
    throw new Error(
      "The credential file is incomplete or belongs to a different panel-demo run.",
    );
  for (const account of accountDefinitions) {
    const credential = parsed.credentials.find(
      (item) => item.key === account.key,
    );
    if (
      !credential ||
      credential.email !== accountEmail(marker, account.key) ||
      !isStrongPassword(credential.password)
    )
      throw new Error(`Credential validation failed for ${account.key}.`);
  }
  return parsed;
}

async function generateCredentials(): Promise<void> {
  const marker = markerFromEnvironment();
  const file = path.resolve(
    requiredFrom(process.env, "PANEL_DEMO_CREDENTIALS_FILE"),
  );
  const credentials = accountDefinitions.map((account) => ({
    key: account.key,
    email: accountEmail(marker, account.key),
    password: `${crypto.randomBytes(22).toString("base64url")}Aa1!`,
  }));
  const content: CredentialFile = {
    format: "advisio-panel-demo-credentials-v1",
    runId: marker,
    createdAt: new Date().toISOString(),
    credentials,
  };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(content, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  try {
    await fs.chmod(file, 0o600);
  } catch {
    /* Windows ACLs are controlled by the file owner. */
  }
  console.log(
    "Panel-demo credentials were generated in the requested private file. Passwords were not printed.",
  );
}

async function createPanelDemo(context: VerifiedContext): Promise<void> {
  const roles = await prisma.role.findMany({
    where: { name: { in: REQUIRED_ROLE_NAMES } },
    select: { id: true, name: true },
  });
  const roleId = new Map(roles.map((role) => [role.name, role.id]));
  if (
    await prisma.user.count({
      where: { universityId: { startsWith: context.marker } },
    })
  )
    throw new Error(
      `Records for ${context.marker} already exist; use inspect or cleanup instead of reseeding.`,
    );
  if (context.dryRun) {
    console.log(
      `Dry run passed: ${context.marker} would create ${accountDefinitions.length} role accounts and one project using Academic Year ${context.academicYear.name}.`,
    );
    return;
  }
  const credentials = await readCredentials(context.marker);
  await prisma.$transaction(
    async (tx) => {
      const users = new Map<string, { id: string }>();
      for (const account of accountDefinitions) {
        const credential = credentials.credentials.find(
          (item) => item.key === account.key,
        )!;
        const user = await tx.user.create({
          data: {
            universityId: accountUniversityId(
              context.marker,
              account.universitySuffix,
            ),
            email: credential.email,
            firstName: account.firstName,
            lastName: account.lastName,
            passwordHash: await bcrypt.hash(credential.password, 12),
            status: "ACTIVE",
            collegeId: context.college.id,
            programId: context.program.id,
            roles: { create: { roleId: roleId.get(account.role)! } },
          },
        });
        users.set(account.key, user);
        if (account.faculty)
          await tx.facultyProfile.create({
            data: {
              userId: user.id,
              academicTitle: "Faculty Member",
              facultyDesignation: account.role.replaceAll("_", " "),
              department: "Information Technology",
              expertiseKeywords: ["capstone", "research methods"],
            },
          });
      }
      const student = users.get("student")!;
      const adviser = users.get("adviser")!;
      const coordinator = users.get("coordinator")!;
      const rpo = users.get("rpo")!;
      await tx.researcherProfile.create({
        data: {
          userId: student.id,
          academicYearId: context.academicYear.id,
          degreeLevel: "UNDERGRADUATE",
          yearLevel: "Fourth Year",
          academicStage: "Capstone",
          academicTerm: "Second Semester",
          researchStatus: "Active",
          groupSetup: "Solo",
          tentativeTitle:
            "AquaWise: Campus Water Use Monitoring and Leak Reporting",
          researchType: "CAPSTONE",
          interests: ["sustainability", "information systems"],
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });
      const researchType = await tx.researchType.create({
        data: {
          programId: context.program.id,
          code: `${context.marker}-CAPSTONE`.slice(0, 50),
          name: `${context.marker} Fictional Capstone`,
          description:
            "Isolated fictional capstone configuration for a panel demonstration.",
        },
      });
      const workflow = await tx.workflow.create({
        data: {
          researchTypeId: researchType.id,
          name: `${context.marker} Capstone Workflow`,
          description:
            "Staging-only workflow. Documents are uploaded through the authorized application workflow.",
          version: 1,
          status: "PUBLISHED",
          createdBy: coordinator.id,
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
        [2, "Adviser Review & Endorsement", "ADVISER", true],
        [3, "Proposal Defense", "PANELIST", true],
        [4, "Ethics Readiness", "RPO", false],
        [5, "Implementation & Manuscript Revision", "RESEARCHER", true],
        [6, "Final Oral Defense", "PANELIST", true],
        [7, "Final Manuscript Approval & Archiving", "RPO", true],
      ];
      const stages = await Promise.all(
        stageDefinitions.map(([sequence, name, role, requiresDocument]) =>
          tx.workflowStage.create({
            data: {
              workflowId: workflow.id,
              sequence,
              name,
              description: `${context.marker}: ${name}`,
              responsibleRoleId: roleId.get(role)!,
              requiresApproval: true,
              requiresDocument,
              isFinal: sequence === 7,
              submissionMode: "TASK",
            },
          }),
        ),
      );
      for (const stage of stages)
        await tx.workflowTask.create({
          data: {
            stageId: stage.id,
            title: `${stage.name} submission`,
            instructions:
              "Upload only newly authored fictional panel-demo material through the authorized staging document workflow.",
            sequence: 1,
            isRequired: stage.requiresDocument,
          },
        });
      const project = await tx.researchProject.create({
        data: {
          researchTypeId: researchType.id,
          programId: context.program.id,
          collegeId: context.college.id,
          academicYearId: context.academicYear.id,
          title:
            "AquaWise: A Campus Water Use Monitoring and Leak Reporting Platform",
          groupName: context.marker,
          participationMode: "SOLO",
          accessMode: "INVITE_ONLY",
          abstract:
            "A fictional capstone used solely to demonstrate Advisio's academic research workflow.",
          status: "UNDER_REVIEW",
          createdBy: student.id,
        },
      });
      const instance = await tx.workflowInstance.create({
        data: {
          researchId: project.id,
          workflowId: workflow.id,
          workflowVersion: workflow.version,
          currentStageId: stages[0].id,
        },
      });
      await tx.researchProject.update({
        where: { id: project.id },
        data: { workflowInstanceId: instance.id },
      });
      await tx.workflowEnrollment.create({
        data: { workflowId: workflow.id, userId: student.id },
      });
      await tx.researchMember.createMany({
        data: [
          { researchId: project.id, userId: student.id, projectRole: "LEADER" },
          {
            researchId: project.id,
            userId: adviser.id,
            projectRole: "ADVISER",
          },
          {
            researchId: project.id,
            userId: coordinator.id,
            projectRole: "COORDINATOR",
          },
          {
            researchId: project.id,
            userId: users.get("panel-chair")!.id,
            projectRole: "PANELIST",
          },
          {
            researchId: project.id,
            userId: users.get("panelist-2")!.id,
            projectRole: "PANELIST",
          },
          {
            researchId: project.id,
            userId: users.get("panelist-3")!.id,
            projectRole: "PANELIST",
          },
        ],
      });
      await tx.adviserRequest.create({
        data: {
          researchId: project.id,
          adviserId: adviser.id,
          requestedById: student.id,
          status: "ACCEPTED",
          note: "Fictional request for capstone guidance.",
          responseNote: "Accepted for the isolated panel demonstration.",
          respondedAt: new Date(),
        },
      });
      const consultation = await tx.consultation.create({
        data: {
          researchId: project.id,
          createdBy: student.id,
          title: "Initial capstone planning consultation",
          description:
            "Fictional agenda: scope, data boundaries, and document revision plan.",
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 45 * 60 * 1000),
          status: "COMPLETED",
          legacyImportKey: `${context.marker}-consultation-1`,
        },
      });
      await tx.consultationParticipant.createMany({
        data: [
          {
            consultationId: consultation.id,
            userId: student.id,
            attendanceStatus: "JOINED",
          },
          {
            consultationId: consultation.id,
            userId: adviser.id,
            attendanceStatus: "JOINED",
          },
        ],
      });
      await tx.consultationNote.create({
        data: {
          consultationId: consultation.id,
          authorId: adviser.id,
          notes:
            "Fictional adviser feedback: refine the problem statement and make the data collection plan measurable.",
          actionItems: [
            {
              owner: "student",
              item: "Revise proposal scope before submission",
            },
          ],
        },
      });
      const defense = await tx.defenseSession.create({
        data: {
          researchId: project.id,
          queueStatus: "WAITING",
          status: "SCHEDULED",
          venue: "Staging Demonstration Room",
          notes:
            "Fictional defense session. It remains scheduled until manuscripts are uploaded and reviewed through the authorized workflow.",
          scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          scheduledEnd: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000,
          ),
          createdBy: rpo.id,
        },
      });
      await tx.defenseInvitation.createMany({
        data: [
          {
            defenseSessionId: defense.id,
            inviteeId: users.get("panel-chair")!.id,
            role: "PANEL_CHAIR",
            status: "ACCEPTED",
          },
          {
            defenseSessionId: defense.id,
            inviteeId: users.get("panelist-2")!.id,
            role: "PANELIST",
            status: "ACCEPTED",
          },
          {
            defenseSessionId: defense.id,
            inviteeId: users.get("panelist-3")!.id,
            role: "PANELIST",
            status: "ACCEPTED",
          },
          {
            defenseSessionId: defense.id,
            inviteeId: adviser.id,
            role: "ADVISER",
            status: "ACCEPTED",
          },
        ],
      });
      await tx.auditLog.create({
        data: {
          userId: context.systemAdministrator.id,
          action: "CREATE",
          entityType: "PanelDemoDataset",
          entityId: project.id,
          newValues: {
            marker: context.marker,
            fictional: true,
            documentsPendingAuthorizedUpload: true,
          },
        },
      });
    },
    { timeout: 30_000 },
  );
  console.log(
    `Created isolated core panel-demo data for ${context.marker}. No documents, document versions, submissions, reviews, or Google Drive identifiers were fabricated.`,
  );
}

async function inspectPanelDemo(context: VerifiedContext): Promise<void> {
  const project = await prisma.researchProject.findFirst({
    where: { groupName: context.marker },
    include: {
      documents: { include: { versions: true, reviews: true } },
      consultations: true,
      defenseSessions: { include: { invitations: true, evaluations: true } },
    },
  });
  const users = await prisma.user.count({
    where: { universityId: { startsWith: context.marker } },
  });
  const readyForDocumentWorkflow = project
    ? project.documents.length > 0
    : false;
  console.log(
    JSON.stringify(
      {
        marker: context.marker,
        academicYear: context.academicYear.name,
        users,
        project: project
          ? {
              id: project.id,
              status: project.status,
              documents: project.documents.length,
              versions: project.documents.reduce(
                (sum, document) => sum + document.versions.length,
                0,
              ),
              reviews: project.documents.reduce(
                (sum, document) => sum + document.reviews.length,
                0,
              ),
              consultations: project.consultations.length,
              defenses: project.defenseSessions.length,
            }
          : null,
        readyForDocumentWorkflow,
      },
      null,
      2,
    ),
  );
}

async function verifyPanelDemo(context: VerifiedContext): Promise<void> {
  const credentials = await readCredentials(context.marker);
  const users = await prisma.user.findMany({
    where: { universityId: { startsWith: context.marker } },
    select: {
      id: true,
      universityId: true,
      email: true,
      passwordHash: true,
      roles: { select: { role: { select: { name: true } } } },
      researcherProfile: { select: { academicYearId: true, status: true } },
    },
  });
  if (users.length !== accountDefinitions.length)
    throw new Error(
      `Expected ${accountDefinitions.length} panel accounts but found ${users.length}.`,
    );
  for (const account of accountDefinitions) {
    const credential = credentials.credentials.find(
      (item) => item.key === account.key,
    )!;
    const user = users.find((item) => item.email === credential.email);
    if (
      !user ||
      !user.passwordHash ||
      !user.roles.some((assignment) => assignment.role.name === account.role)
    )
      throw new Error(`Role verification failed for ${account.key}.`);
    if (!(await bcrypt.compare(credential.password, user.passwordHash)))
      throw new Error(`Credential verification failed for ${account.key}.`);
    if (
      account.role === "RESEARCHER" &&
      (!user.researcherProfile ||
        user.researcherProfile.academicYearId !== context.academicYear.id ||
        user.researcherProfile.status !== "SUBMITTED")
    )
      throw new Error("Student onboarding verification failed.");
  }
  const project = await prisma.researchProject.findFirst({
    where: { groupName: context.marker },
    include: {
      members: true,
      consultations: true,
      defenseSessions: { include: { invitations: true } },
      documents: true,
    },
  });
  if (
    !project ||
    project.members.length < 6 ||
    project.consultations.length < 1 ||
    project.defenseSessions.length !== 1 ||
    project.defenseSessions[0].invitations.length !== 4
  )
    throw new Error("Project workflow verification failed.");
  console.log(
    `Verified ${users.length} panel logins, their role bindings, student onboarding Academic Year, project membership, consultation, and defense invitations. ${project.documents.length === 0 ? "Document workflow remains pending authorized staging uploads." : "Authorized staging documents are present."}`,
  );
}

async function cleanupPanelDemo(context: VerifiedContext): Promise<void> {
  if (
    process.env.PANEL_DEMO_CLEANUP_CONFIRMATION !== `DELETE:${context.marker}`
  )
    throw new Error(
      "Set PANEL_DEMO_CLEANUP_CONFIRMATION=DELETE:<PANEL_DEMO_RUN_ID> to authorize cleanup.",
    );
  const project = await prisma.researchProject.findFirst({
    where: { groupName: context.marker },
    include: { documents: true, officialCopies: true },
  });
  if (project?.officialCopies.length)
    throw new Error(
      "Refusing cleanup because this panel project has official archive records.",
    );
  if (project?.documents.length)
    throw new Error(
      "Refusing cleanup while panel documents exist. Remove fictional files through the authorized staging document workflow first, then rerun cleanup.",
    );
  if (context.dryRun) {
    console.log(
      `Dry run passed: ${context.marker} contains no documents and is eligible for bounded cleanup.`,
    );
    return;
  }
  const users = await prisma.user.findMany({
    where: { universityId: { startsWith: context.marker } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  await prisma.$transaction(
    async (tx) => {
      if (project) {
        await tx.researchProject.update({
          where: { id: project.id },
          data: { workflowInstanceId: null },
        });
        await tx.workflowInstance.deleteMany({
          where: { researchId: project.id },
        });
        await tx.researchProject.delete({ where: { id: project.id } });
      }
      const workflows = await tx.workflow.findMany({
        where: { name: { startsWith: context.marker } },
        select: { id: true },
      });
      const workflowIds = workflows.map((workflow) => workflow.id);
      const researchTypes = await tx.researchType.findMany({
        where: { code: { startsWith: context.marker } },
        select: { id: true },
      });
      if (researchTypes.length)
        await tx.researchType.updateMany({
          where: { id: { in: researchTypes.map((item) => item.id) } },
          data: { workflowId: null },
        });
      if (workflowIds.length)
        await tx.workflow.deleteMany({ where: { id: { in: workflowIds } } });
      if (researchTypes.length)
        await tx.researchType.deleteMany({
          where: { id: { in: researchTypes.map((item) => item.id) } },
        });
      if (userIds.length) {
        await tx.auditLog.deleteMany({
          where: {
            OR: [
              { userId: { in: userIds } },
              {
                entityType: "PanelDemoDataset",
                ...(project && { entityId: project.id }),
              },
            ],
          },
        });
        await tx.facultyProfile.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }
    },
    { timeout: 30_000 },
  );
  const remaining = await prisma.user.count({
    where: { universityId: { startsWith: context.marker } },
  });
  if (remaining)
    throw new Error(
      `Cleanup incomplete: ${remaining} marked account(s) remain.`,
    );
  console.log(
    `Removed only panel-demo records marked ${context.marker}. Reference data and the bootstrapped administrator were preserved.`,
  );
}

async function main() {
  const command = process.argv[2];
  if (command === "credentials") return generateCredentials();
  if (
    !["preflight", "seed", "inspect", "verify", "cleanup"].includes(
      command || "",
    )
  )
    throw new Error(
      "Usage: panel-demo.js <credentials|preflight|seed|inspect|verify|cleanup>",
    );
  const context = await verifyPanelDemoTarget();
  if (command === "preflight") {
    console.log(
      `Preflight passed for ${context.marker}; active Academic Year: ${context.academicYear.name}.`,
    );
    return;
  }
  if (command === "seed") return createPanelDemo(context);
  if (command === "inspect") return inspectPanelDemo(context);
  if (command === "verify") return verifyPanelDemo(context);
  return cleanupPanelDemo(context);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
)
  main()
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Panel-demo operation failed.",
      );
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
