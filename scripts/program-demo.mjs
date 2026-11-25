import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomBytes, createHash } from "node:crypto";
import {
  DATASET,
  DATASET_ID,
  PROGRAMS,
  accounts,
  milestones,
  validateTarget,
  assertOwnedRoots,
  demoPassword,
  facultyMembership,
  accountName,
} from "./program-demo-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/api/package.json"));
const bcrypt = require("bcryptjs");
let privateDir = path.join(root, ".demo-local", "four-programs");
const command = process.argv[2] || "plan";
const json = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? Number(v) : v)),
  );
const day = (n) => new Date(Date.now() + n * 86400000);
const digest = (data) => createHash("sha256").update(data).digest("hex");
const output = (value) =>
  console.log(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? Number(v) : v), 2),
  );
let db,
  documentService,
  progress,
  eligibility,
  ledger,
  evaluation,
  PDFDocument,
  StandardFonts,
  defaultEvaluationBranding;

async function configure() {
  const dotenv = require("dotenv");
  dotenv.config({ path: path.join(root, ".env.program-demo.local") });
  const target = validateTarget(process.env);
  privateDir = path.join(
    privateDir,
    createHash("sha256")
      .update(`${target.host}/${target.database}`)
      .digest("hex")
      .slice(0, 12),
  );
  // Only this maintenance process receives the selected connection. Never rewrite deployment variables.
  process.env.DATABASE_URL = process.env.PROGRAM_DEMO_DATABASE_URL;
  process.env.DIRECT_URL = process.env.PROGRAM_DEMO_DATABASE_URL;
  process.chdir(path.join(root, "apps/api"));
  ({ prisma: db } = await import("../apps/api/src/lib/prisma.ts"));
  const [identity] = await db.$queryRawUnsafe(
    "SELECT current_database() AS database, current_schema() AS schema, pg_is_in_recovery() AS replica",
  );
  if (
    identity.database !== target.database ||
    identity.schema !== target.schema ||
    identity.replica
  )
    throw new Error(
      "The live database identity did not match the declared writable target.",
    );
  const years = await db.academicYear.findMany({
    where: { isCurrent: true, isActive: true },
  });
  if (years.length !== 1)
    throw new Error(
      "Exactly one active current academic year is required. Existing academic years are never changed.",
    );
  const catalog = [];
  for (const program of PROGRAMS)
    catalog.push(
      await db.program.findFirstOrThrow({
        where: {
          code: program.code,
          isActive: true,
          college: { code: program.college, isActive: true },
        },
        include: { college: true },
      }),
    );
  const roles = await db.role.findMany();
  for (const role of new Set(accounts().map((a) => a.role)))
    if (!roles.some((r) => r.name === role))
      throw new Error(`Missing reference role ${role}.`);
  return { target, year: years[0], catalog, roles };
}

async function lock(tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${DATASET}))`;
}

async function roots(client = db) {
  const users = await client.user.findMany({
    where: {
      OR: [
        { email: { in: accounts().map((a) => a.email) } },
        { universityId: { in: accounts().map((a) => a.universityId) } },
      ],
    },
    include: { roles: { include: { role: true } } },
  });
  const types = await client.researchType.findMany({
    where: { code: { in: PROGRAMS.map((p) => `DEMO4-${p.code}`) } },
  });
  const workflows = await client.workflow.findMany({
    where: { name: { in: PROGRAMS.map((p) => `${DATASET} ${p.code}`) } },
  });
  const projects = await client.researchProject.findMany({
    where: {
      groupName: {
        in: PROGRAMS.flatMap((p) =>
          ["A", "B"].map((g) => `${DATASET}:${p.code}:${g}`),
        ),
      },
    },
    include: {
      members: true,
      officialCopies: true,
      workflowInstance: true,
      documents: { include: { versions: true } },
      defenseSessions: true,
    },
  });
  const workspaces = await client.researchWorkspace.findMany({
    where: {
      name: {
        in: PROGRAMS.flatMap((p) =>
          ["A", "B"].map((g) => `${DATASET}:${p.code}:${g}`),
        ),
      },
    },
    include: { members: true, projects: { select: { id: true } } },
  });
  const named = await client.auditLog.findMany({
    where: {
      entityType: "User",
      entityId: { in: users.map((u) => u.id) },
      eventType: "PROGRAM_DEMO_ACCOUNT_RENAMED",
    },
    orderBy: { createdAt: "desc" },
  });
  for (const user of users) {
    const change = named.find(
      (e) => e.entityId === user.id && e.newValues?.dataset === DATASET,
    );
    if (change) user.approvedDemoName = change.newValues.name;
  }
  return { users, types, workflows, projects, workspaces };
}

async function seedCore(context) {
  const hashes = new Map();
  for (const p of PROGRAMS)
    hashes.set(p.code, await bcrypt.hash(demoPassword(p), 12));
  await db.$transaction(
    async (tx) => {
      await lock(tx);
      const existing = await roots(tx);
      if (Object.values(existing).some((rows) => rows.length))
        throw new Error(
          "Demo records already exist. Use prepare to resume, or inspect/cleanup-preview before resetting. No existing passwords or records were overwritten.",
        );
      const users = new Map();
      for (const account of accounts()) {
        const program = context.catalog.find((p) => p.code === account.program);
        const user = await tx.user.create({
          data: {
            email: account.email,
            universityId: account.universityId,
            ...accountName(account),
            passwordHash: hashes.get(account.program),
            status: "ACTIVE",
            collegeId: program.collegeId,
            programId: account.role === "DEAN" ? null : program.id,
            colorThemePreference: "COLLEGE_PROGRAM",
            maxAdviseeGroups: 2,
            roles: {
              create: {
                roleId: context.roles.find((r) => r.name === account.role).id,
              },
            },
            collegeMemberships: facultyMembership(account, program.collegeId),
          },
        });
        users.set(`${account.program}:${account.key}`, user);
        if (account.role === "RESEARCHER")
          await tx.researcherProfile.create({
            data: {
              userId: user.id,
              academicYearId: context.year.id,
              degreeLevel: "UNDERGRADUATE",
              yearLevel: "YEAR_4",
              academicTerm: "FIRST_SEMESTER",
              researchStatus: "HAS_PROJECT",
              groupSetup: "GROUP",
              researchType: "GROUP",
              interests: [program.name],
              status: "SUBMITTED",
              submittedAt: new Date(),
            },
          });
        else
          await tx.facultyProfile.create({
            data: {
              userId: user.id,
              academicTitle: "Demo Faculty",
              facultyDesignation: account.role.replaceAll("_", " "),
              department: program.name,
              biography: `${DATASET}: fictional demonstration identity.`,
              expertiseKeywords: [program.name],
              researchInterests: [program.name],
              acceptedResearchTypes: [
                PROGRAMS.find((p) => p.code === account.program).label,
              ],
            },
          });
      }
      // Audit arrays are bounded to 50 entries; use an ID map for the 56 accounts.
      const manifest = {
        dataset: DATASET,
        users: Object.fromEntries([...users.values()].map((u) => [u.id, true])),
        types: [],
        workflows: [],
        projects: [],
        workspaces: [],
      };
      for (const definition of PROGRAMS) {
        const program = context.catalog.find((p) => p.code === definition.code);
        const professor = users.get(`${definition.code}:professor`);
        const researchType = await tx.researchType.create({
          data: {
            programId: program.id,
            code: `DEMO4-${definition.code}`,
            name: `Demo ${definition.label}`,
            description: definition.method,
          },
        });
        const workflow = await tx.workflow.create({
          data: {
            researchTypeId: researchType.id,
            name: `${DATASET} ${definition.code}`,
            description: `${definition.method} All documents and approvals are fictional demo examples.`,
            version: 1,
            createdBy: professor.id,
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        });
        manifest.types.push(researchType.id);
        manifest.workflows.push(workflow.id);
        await tx.researchType.update({
          where: { id: researchType.id },
          data: { workflowId: workflow.id },
        });
        const topics = [];
        for (const [index, title] of [
          "Getting started",
          "Research proposal",
          "Research or development",
          "Final defense and completion",
        ].entries())
          topics.push(
            await tx.workflowTopic.create({
              data: { workflowId: workflow.id, title, sequence: index + 1 },
            }),
          );
        let previous = null;
        const stages = [];
        for (const [index, step] of milestones(definition).entries()) {
          const stage = await tx.workflowStage.create({
            data: {
              workflowId: workflow.id,
              topicId:
                topics[index < 2 ? 0 : index < 5 ? 1 : index < 7 ? 2 : 3].id,
              sequence: index + 1,
              name: step.name,
              description: `${DATASET}: ${step.name}. Use fictional data and demo forms only.`,
              responsibleRoleId: context.roles.find((r) => r.name === step.role)
                .id,
              milestoneType: step.type,
              requiresDocument: step.files,
              requiresApproval: true,
              requiredMilestoneId: previous,
              submissionMode: "TASK",
              isFinal: index === 9,
            },
          });
          if (step.files)
            await tx.workflowTask.create({
              data: {
                stageId: stage.id,
                sequence: 1,
                title: step.name,
                instructions: `${definition.method}\nSubmit the ${step.name.toLowerCase()} document as PDF or DOCX. Defense scheduling additionally requires eligibility approval and a signed Dean letter for that cycle.`,
                isRequired: true,
                allowedFileTypes: "PDF,DOCX",
              },
            });
          previous = stage.id;
          stages.push(stage);
        }
        await tx.workflowEnrollment.createMany({
          data: Array.from({ length: 8 }, (_, i) => ({
            workflowId: workflow.id,
            userId: users.get(`${definition.code}:student${i + 1}`).id,
          })),
        });
        await tx.workflowAccessEntry.createMany({
          data: Array.from({ length: 8 }, (_, i) => ({
            workflowId: workflow.id,
            userId: users.get(`${definition.code}:student${i + 1}`).id,
            kind: "REQUEST",
            status: "APPROVED",
            actorId: professor.id,
            decidedBy: professor.id,
            decidedAt: new Date(),
          })),
        });
        for (const [groupIndex, group] of ["A", "B"].entries()) {
          const roster = Array.from({ length: 4 }, (_, i) =>
            users.get(`${definition.code}:student${groupIndex * 4 + i + 1}`),
          );
          const name = `${DATASET}:${definition.code}:${group}`;
          const workspace = await tx.researchWorkspace.create({
            data: {
              name,
              programId: program.id,
              collegeId: program.collegeId,
              createdBy: roster[0].id,
              participationMode: "GROUP",
              accessMode: "INVITE_ONLY",
              inviteCode: randomBytes(12).toString("hex"),
              inviteCodeEnabled: false,
              members: {
                create: roster.map((u, i) => ({
                  userId: u.id,
                  role: i === 0 ? "LEADER" : "MEMBER",
                })),
              },
            },
          });
          const project = await tx.researchProject.create({
            data: {
              title:
                group === "A"
                  ? `Untitled ${definition.code} Demo Group A`
                  : definition.titles[1],
              groupName: name,
              workspaceId: workspace.id,
              researchTypeId: researchType.id,
              programId: program.id,
              collegeId: program.collegeId,
              academicYearId: context.year.id,
              createdBy: roster[0].id,
              participationMode: "GROUP",
              accessMode: "INVITE_ONLY",
              workflowDraft: group === "A",
              registeredAt: group === "B" ? day(-40) : null,
              status: group === "A" ? "DRAFT" : "REVISION",
              abstract: `${DATASET}: fictional demonstration. ${definition.method}`,
            },
          });
          manifest.projects.push(project.id);
          manifest.workspaces.push(workspace.id);
          const instance = await tx.workflowInstance.create({
            data: {
              researchId: project.id,
              workflowId: workflow.id,
              workflowVersion: 1,
              currentStageId: stages[group === "A" ? 0 : 7].id,
            },
          });
          await tx.researchProject.update({
            where: { id: project.id },
            data: { workflowInstanceId: instance.id },
          });
          await tx.researchMember.createMany({
            data: [
              ...roster.map((u, i) => ({
                researchId: project.id,
                userId: u.id,
                projectRole: i === 0 ? "LEADER" : "MEMBER",
              })),
              {
                researchId: project.id,
                userId: professor.id,
                projectRole: "COORDINATOR",
              },
              ...(group === "B"
                ? [
                    {
                      researchId: project.id,
                      userId: users.get(`${definition.code}:adviser`).id,
                      projectRole: "ADVISER",
                    },
                    ...[1, 2, 3].map((n) => ({
                      researchId: project.id,
                      userId: users.get(`${definition.code}:panel${n}`).id,
                      projectRole: "PANELIST",
                    })),
                  ]
                : []),
            ],
          });
          if (group === "B") {
            await tx.adviserRequest.create({
              data: {
                researchId: project.id,
                adviserId: users.get(`${definition.code}:adviser`).id,
                requestedById: roster[0].id,
                workflowStageId: stages.find(
                  (s) => s.milestoneType === "ADVISER_SELECTION",
                ).id,
                status: "ACCEPTED",
                note: "Fictional demo adviser request.",
                responseNote: "Accepted for the demo.",
                respondedAt: day(-39),
              },
            });
            await tx.titleProposalSubmission.create({
              data: {
                researchId: project.id,
                stageId: stages.find(
                  (s) => s.milestoneType === "TITLE_PROPOSAL",
                ).id,
                titles: [
                  definition.titles[1],
                  definition.titles[0],
                  `${definition.titles[1]}: An Exploratory Study`,
                ],
                status: "APPROVED",
                selectedIndex: 0,
                submittedBy: roster[0].id,
                reviewedBy: professor.id,
                reviewNote: "Fictional demo title approval.",
                reviewedAt: day(-38),
              },
            });
          }
        }
      }
      await tx.auditLog.create({
        data: {
          userId: null,
          action: "CREATE",
          entityType: "ProgramDemoDataset",
          entityId: DATASET_ID,
          eventType: "PROGRAM_DEMO_CREATED",
          newValues: json(manifest),
        },
      });
    },
    { timeout: 120000, maxWait: 10000 },
  );
  await writeAccounts(context);
}

async function nameAccounts() {
  const encoded = process.env.PROGRAM_DEMO_STUDENT_NAMES;
  const students = encoded
    ? JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))
    : null;
  if (students) {
    if (
      Object.keys(students).length !== PROGRAMS.length ||
      PROGRAMS.some(
        (p) =>
          !Array.isArray(students[p.code]) || students[p.code].length !== 8,
      )
    )
      throw new Error(
        "Supply exactly eight student names for each of the four demo programs.",
      );
    for (const name of Object.values(students).flat()) {
      if (
        Object.keys(name).some(
          (key) => !["firstName", "middleName", "lastName"].includes(key),
        ) ||
        ["firstName", "lastName"].some(
          (key) =>
            typeof name[key] !== "string" ||
            !name[key].trim() ||
            name[key].length > 100,
        ) ||
        (name.middleName != null &&
          (typeof name.middleName !== "string" || name.middleName.length > 100))
      )
        throw new Error(
          "Only valid first, middle, and last name fields are accepted.",
        );
    }
  }
  const result = await db.$transaction(
    async (tx) => {
      await lock(tx);
      const data = await roots(tx);
      assertOwnedRoots(data);
      const creation = await tx.auditLog.findFirst({
        where: {
          entityId: DATASET_ID,
          entityType: "ProgramDemoDataset",
          eventType: "PROGRAM_DEMO_CREATED",
        },
        orderBy: { createdAt: "desc" },
      });
      const changed = [];
      for (const account of accounts().filter(
        (a) => a.role === "DEAN" || (students && a.role === "RESEARCHER"),
      )) {
        const user = data.users.find((u) => u.email === account.email);
        if (!user || !Object.hasOwn(creation?.newValues?.users || {}, user.id))
          throw new Error(
            "The account must belong to the immutable demo creation manifest.",
          );
        const name =
          account.role === "DEAN"
            ? accountName(account)
            : students[account.program][Number(account.key.slice(7)) - 1];
        if (
          !["firstName", "middleName", "lastName"].every(
            (key) => (user[key] || null) === (name[key] || null),
          )
        ) {
          await tx.user.update({ where: { id: user.id }, data: name });
          await tx.auditLog.create({
            data: {
              userId: null,
              action: "UPDATE",
              entityType: "User",
              entityId: user.id,
              eventType: "PROGRAM_DEMO_ACCOUNT_RENAMED",
              oldValues: {
                firstName: user.firstName,
                middleName: user.middleName,
                lastName: user.lastName,
              },
              newValues: {
                dataset: DATASET,
                name,
                source:
                  account.role === "DEAN"
                    ? "https://web.ua.edu.ph/administration/"
                    : "User-selected college roster",
              },
            },
          });
        }
        changed.push({ email: account.email, ...name });
      }
      return changed;
    },
    { isolationLevel: "Serializable", timeout: 30000 },
  );
  output({ namedAccounts: result });
}

async function writeAccounts(context) {
  await fs.mkdir(privateDir, { recursive: true });
  const rows = accounts().map((a) => ({
    ...a,
    password: demoPassword(PROGRAMS.find((p) => p.code === a.program)),
  }));
  await fs.writeFile(
    path.join(privateDir, "accounts.csv"),
    [
      "Program,Role,Email,Password,Group",
      ...rows.map(
        (a) =>
          `${a.program},${a.role},${a.email},${a.password},${a.role === "RESEARCHER" ? (Number(a.key.slice(7)) <= 4 ? "A" : "B") : ""}`,
      ),
    ].join("\r\n"),
    { mode: 0o600 },
  );
  await fs.writeFile(
    path.join(privateDir, "target.json"),
    JSON.stringify(
      {
        dataset: DATASET,
        target: context.target,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}

async function loadServices() {
  ({ documentService } =
    await import("../apps/api/src/services/document.service.ts"));
  ({ getMilestoneProgress: progress } =
    await import("../apps/api/src/services/research-workflow-integration.service.ts"));
  eligibility =
    await import("../apps/api/src/services/defense-eligibility.service.ts");
  ledger =
    await import("../apps/api/src/services/evaluation-ledger.service.ts");
  evaluation =
    await import("../apps/api/src/services/structured-evaluation.service.ts");
  ({ PDFDocument, StandardFonts } = require("pdf-lib"));
  ({ defaultEvaluationBranding } =
    await import("@research-management/validations"));
}

function defenseForm(definition, collegeName, final = false) {
  return {
    name: `${definition.label} ${final ? "Final" : "Proposal"} Defense - Demo`,
    branding: {
      ...defaultEvaluationBranding,
      collegeName,
      templateName: "Fictional demo evaluation form",
    },
    scale: [
      { value: 1, label: "Needs improvement" },
      { value: 2, label: "Developing" },
      { value: 3, label: "Proficient" },
      { value: 4, label: "Excellent" },
    ],
    presentation: [
      { id: "clarity", title: "Presentation clarity", weight: 60 },
      { id: "response", title: "Response to questions", weight: 40 },
    ],
    manuscript: [
      {
        id: "scope",
        title:
          definition.code === "BSCPE"
            ? "Design scope and requirements"
            : "Research scope",
        weight: 40,
      },
      {
        id: "method",
        title:
          definition.code === "BSCPE"
            ? "Prototype testing and evidence"
            : "Method and evidence",
        weight: 40,
      },
      { id: "organization", title: "Organization", weight: 20 },
    ],
    feedbackLabel: "Recommendations",
    feedbackPrompt: "Fictional demo feedback only.",
    signatureRequired: false,
  };
}

export async function samplePdf(title, paragraphs) {
  if (!PDFDocument) ({ PDFDocument, StandardFonts } = require("pdf-lib"));
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page, y;
  function newPage() {
    page = pdf.addPage([612, 792]);
    y = 735;
    page.drawText("ADVISIO | FICTIONAL DEMO MATERIAL", {
      x: 45,
      y,
      size: 11,
      font: bold,
    });
    y -= 35;
    page.drawText(DATASET, { x: 45, y: 30, size: 8, font });
  }
  newPage();
  for (const [index, text] of [title, ...paragraphs].entries()) {
    let line = "";
    const currentFont = index === 0 ? bold : font,
      size = index === 0 ? 14 : 11;
    const draw = () => {
      if (y < 65) newPage();
      page.drawText(line, { x: 45, y, size, font: currentFont });
      y -= 18;
    };
    for (const word of text.replace(/[^\x20-\x7e\n]/g, "-").split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (currentFont.widthOfTextAtSize(candidate, size) > 515 && line) {
        draw();
        line = word;
      } else line = candidate;
    }
    if (line) draw();
    y -= 14;
  }
  return Buffer.from(await pdf.save());
}

async function submitFixture(project, stage, definition, status) {
  const task = stage.tasks[0];
  const prior = await db.taskSubmission.findUnique({
    where: { researchId_taskId: { researchId: project.id, taskId: task.id } },
    include: { documentVersion: true },
  });
  if (prior) return prior.documentVersion;
  let buffer = await samplePdf(`${definition.label}: ${stage.name}`, [
    project.title,
    definition.method,
    "This is a newly authored fictional fixture. It contains no real participant information, findings, institutional clearance, or approval.",
    `Requirement: ${stage.name}.`,
    definition.work,
    status === "REVISION_REQUIRED"
      ? "Revision requested: explain the sampling or testing procedure, clarify limitations, and align the conclusions with the evidence."
      : "Fictional faculty review: this example is approved for demonstration of the next workflow step.",
  ]);
  // Resume an upload whose following submission transaction was interrupted.
  const draft = await db.document.findFirst({
    where: {
      researchId: project.id,
      milestoneId: stage.id,
      documentType: `TASK_${task.id}`,
      createdBy: project.createdBy,
    },
    include: { versions: true },
  });
  if (draft) {
    if (draft.versions.length !== 1 || draft.versions[0].isImmutable)
      throw new Error(
        "Unexpected existing demo manuscript; inspect before resuming.",
      );
    ({ buffer } = await documentService.readStoredVersionFile({
      storageProvider: draft.storageProvider,
      storagePath: draft.versions[0].storagePath,
      googleDriveFileId: draft.versions[0].googleDriveFileId,
      expectedSize: draft.versions[0].fileSize,
    }));
  }
  const created = draft
    ? { document: draft, version: draft.versions[0] }
    : await documentService.createDocumentWithVersion({
        researchId: project.id,
        milestoneId: stage.id,
        title: `Demo ${stage.name}`,
        documentType: `TASK_${task.id}`,
        fileBuffer: buffer,
        fileName: `DEMO4-${definition.code}-B-M${stage.sequence}.pdf`,
        mimeType: "application/pdf",
        uploadedBy: project.createdBy,
      });
  const lifecycle = status === "APPROVED" ? "APPROVED" : "REVISION_REQUIRED";
  const professor = project.members.find(
    (m) => m.projectRole === "COORDINATOR",
  ).userId;
  await db.$transaction(async (tx) => {
    await tx.documentVersion.update({
      where: { id: created.version.id },
      data: {
        isImmutable: true,
        contentChecksum: digest(buffer),
        submissionKey: `demo:${stage.id}:1`,
        manuscriptStatus: lifecycle,
        submittedBy: project.createdBy,
        submittedAt: day(-2),
        snapshotCreatedAt: day(-2),
        milestoneId: stage.id,
      },
    });
    await tx.document.update({
      where: { id: created.document.id },
      data: { lifecycleStatus: lifecycle },
    });
    const data = {
      researchId: project.id,
      taskId: task.id,
      documentId: created.document.id,
      documentVersionId: created.version.id,
      submittedBy: project.createdBy,
      status,
      note: `${DATASET}: fictional submission.`,
      reviewNote:
        status === "APPROVED"
          ? "Fictional demo approval."
          : "Clarify the sampling/testing procedure and limitations before final defense.",
      reviewedAt: day(-1),
    };
    const summary = await tx.taskSubmission.create({ data });
    await tx.taskSubmissionAttempt.create({
      data: {
        ...data,
        taskSubmissionId: summary.id,
        milestoneId: stage.id,
        attemptNumber: 1,
      },
    });
    await tx.review.create({
      data: {
        documentId: created.document.id,
        documentVersionId: created.version.id,
        reviewerId: professor,
        reviewType: "COORDINATOR",
        status: "SUBMITTED",
        recommendation: status === "APPROVED" ? "APPROVE" : "MINOR_REVISION",
        overallComment: data.reviewNote,
        submittedAt: day(-1),
      },
    });
  });
  return db.documentVersion.findUniqueOrThrow({
    where: { id: created.version.id },
  });
}

async function completedProposal(
  project,
  definition,
  stage,
  manuscript,
  program,
) {
  if (await db.defenseSession.findFirst({ where: { researchId: project.id } }))
    return;
  const professor = project.members.find(
    (m) => m.projectRole === "COORDINATOR",
  ).userId;
  const users = await db.user.findMany({
    where: { id: { in: project.members.map((m) => m.userId) } },
  });
  const roster = project.members
    .filter((m) => ["LEADER", "MEMBER"].includes(m.projectRole))
    .map((m) => ({
      userId: m.userId,
      name: `Demo ${definition.code} ${users
        .find((u) => u.id === m.userId)
        .lastName.split(" ")
        .at(-1)}`,
    }));
  const panels = project.members
    .filter((m) => m.projectRole === "PANELIST")
    .map((m) => ({
      userId: m.userId,
      name: `Demo ${users.find((u) => u.id === m.userId).lastName}`,
      required: true,
    }));
  const form = defenseForm(definition, program.college.name);
  const snapshot = {
    spec: form,
    roster,
    panelists: panels,
    researchTitle: project.title,
    manuscriptVersionId: manuscript.id,
    publishedAt: day(-1).toISOString(),
  };
  const scored = evaluation.scoreStructuredEvaluation(
    snapshot,
    {
      researchers: Object.fromEntries(
        roster.map((r) => [r.userId, { clarity: 3, response: 3 }]),
      ),
      manuscript: { scope: 3, method: 3, organization: 3 },
      recommendation: "APPROVED",
      feedback:
        "Fictional proposal evaluation. Continue the approved demo study.",
      signature: "",
    },
    true,
  );
  const pdfs = await Promise.all(
    panels.map((p) =>
      evaluation.renderStructuredEvaluation(snapshot, scored.answers, p.name),
    ),
  );
  await db.$transaction(
    async (tx) => {
      await lock(tx);
      const grant = await tx.defenseEligibility.create({
        data: {
          researchId: project.id,
          milestoneId: stage.id,
          approvedBy: professor,
          approvedAt: day(-1),
          consumedAt: new Date(),
        },
      });
      const event = await tx.defenseEvent.create({
        data: {
          code: `DEMO4-${definition.code}-PROPOSAL`,
          collegeId: program.collegeId,
          defenseType: "TITLE_DEFENSE",
          status: "COMPLETED",
          scheduledStart: day(-1),
          scheduledEnd: day(-1 + 1 / 24),
          venue: "Fictional Demo Defense Room",
          createdBy: professor,
          startedAt: day(-1),
          completedAt: day(-1 + 1 / 24),
          notes: `${DATASET}: fictional historical scenario, not an actual institutional defense.`,
        },
      });
      const session = await tx.defenseSession.create({
        data: {
          researchId: project.id,
          eligibilityId: grant.id,
          defenseEventId: event.id,
          status: "COMPLETED",
          queueStatus: "COMPLETED",
          queuePosition: 1,
          decision: "APPROVED",
          createdBy: professor,
          startedBy: professor,
          startedAt: day(-1),
          endedAt: day(-1 + 1 / 24),
          releasedAt: new Date(),
          releasedBy: professor,
          scheduledStart: event.scheduledStart,
          scheduledEnd: event.scheduledEnd,
          venue: event.venue,
          evaluationLedgerStartedAt: new Date(),
          notes: event.notes,
        },
      });
      await tx.defenseInvitation.createMany({
        data: panels.map((p, i) => ({
          defenseSessionId: session.id,
          inviteeId: p.userId,
          role: i ? "PANELIST" : "PANEL_CHAIR",
          status: "ACCEPTED",
          respondedAt: day(-1),
        })),
      });
      await tx.defensePacket.create({
        data: {
          defenseSessionId: session.id,
          manuscriptVersionId: manuscript.id,
          publishedById: professor,
          publishedAt: new Date(),
          status: "PUBLISHED",
          evaluationMode: "STRUCTURED",
          structuredForm: json(snapshot),
          evaluationSignatureRequired: false,
        },
      });
      await ledger.appendEvaluationEvent(tx, {
        sessionId: session.id,
        eventType: "FORM_PUBLISHED",
        actorId: professor,
        actorRoles: ["RESEARCH_COORDINATOR"],
        operationId: `form:${session.id}:1`,
        payload: {
          snapshot,
          mappingVersion: 1,
          publicationReason: "Fictional seeded demonstration history.",
        },
      });
      for (const [i, panel] of panels.entries()) {
        const record = await tx.structuredEvaluation.create({
          data: {
            defenseSessionId: session.id,
            panelistId: panel.userId,
            revision: 1,
            answers: json(scored.answers),
            totals: json(scored.totals),
            lockedAt: new Date(),
            pdfData: Uint8Array.from(pdfs[i]),
            previewHash: evaluation.evaluationPdfHash(pdfs[i]),
          },
        });
        await ledger.appendEvaluationEvent(tx, {
          sessionId: session.id,
          eventType: "EVALUATION_SUBMITTED",
          actorId: panel.userId,
          actorRoles: ["PANELIST"],
          operationId: `evaluation:${record.id}:1`,
          payload: ledger.submissionPayload(record),
        });
      }
      const { state, events } = await ledger.loadEvaluationIntegrity(
        tx,
        session.id,
      );
      await ledger.appendEvaluationEvent(tx, {
        sessionId: session.id,
        eventType: "RESULT_RELEASED",
        actorId: professor,
        actorRoles: ["RESEARCH_COORDINATOR"],
        operationId: `release:${session.id}`,
        payload: ledger.releasePayload(
          state,
          events,
          "Fictional seeded proposal history. All three demo panelists submitted.",
        ),
      });
      ledger.assertEvaluationIntegrity(
        (await ledger.loadEvaluationIntegrity(tx, session.id)).verification,
      );
    },
    { timeout: 60000 },
  );
}

async function prepare(context) {
  await loadServices();
  const data = await roots();
  assertOwnedRoots(data);
  for (const definition of PROGRAMS) {
    const workflow = data.workflows.find(
      (w) => w.name === `${DATASET} ${definition.code}`,
    );
    const program = context.catalog.find((p) => p.code === definition.code);
    if (!workflow) throw new Error("Create the dataset before preparing it.");
    const form = defenseForm(definition, program.college.name, true);
    if (
      !(await db.structuredEvaluationTemplate.findFirst({
        where: { createdBy: workflow.createdBy },
      }))
    )
      await db.structuredEvaluationTemplate.create({
        data: {
          collegeId: program.collegeId,
          createdBy: workflow.createdBy,
          spec: json(form),
        },
      });
    if (
      !(await db.workflowResource.findFirst({
        where: {
          workflowId: workflow.id,
          title: "Demo workflow guide and submission checklist",
        },
      }))
    ) {
      const guide = await samplePdf(`${definition.label}: workflow guide`, [
        definition.method,
        definition.code === "BEED"
          ? "Group A: students 1-4 begin with the first milestone. Group B: students 5-8 have approved demo proposal, ethics and instrument documents and a final manuscript awaiting revision. Education has one onsite defense after manuscript completion."
          : "Group A: students 1-4 begin with the first milestone. Group B: students 5-8 have a fictional completed proposal defense and a final manuscript awaiting revision.",
        ...milestones(definition).map((s, i) => `${i + 1}. ${s.name}`),
        "Defense handoff: approve required submissions, grant eligibility, request and sign the Dean letter for this cycle, schedule the defense, accept panel invitations, publish the manuscript packet, evaluate, and release the official result.",
        "Use only newly authored fictional documents. Ethics applications, instrument validation, defense results and sample data in this dataset do not represent real institutional decisions.",
      ]);
      const { storeWorkflowResourceFile } =
        await import("../apps/api/src/services/workflow-resource-storage.service.ts");
      const stored = await storeWorkflowResourceFile(
        workflow,
        {
          originalname: `DEMO4-${definition.code}-guide.pdf`,
          mimetype: "application/pdf",
          buffer: guide,
        },
        "Demo workflow guide and submission checklist",
      );
      try {
        await db.workflowResource.create({
          data: {
            workflowId: workflow.id,
            title: "Demo workflow guide and submission checklist",
            description: DATASET,
            fileName: stored.fileName,
            mimeType: "application/pdf",
            fileSize: BigInt(stored.sizeBytes),
            storagePath: stored.storagePath,
            googleDriveFileId: stored.googleDriveFileId,
            uploadedBy: workflow.createdBy,
          },
        });
      } catch (error) {
        await documentService.cleanupStoredFile(
          process.env.STORAGE_PROVIDER || "GOOGLE_DRIVE",
          stored,
        );
        throw error;
      }
    }
    const project = data.projects.find(
      (p) => p.groupName === `${DATASET}:${definition.code}:B`,
    );
    if (!project) throw new Error("Create the dataset before preparing it.");
    const stages = await db.workflowStage.findMany({
      where: { workflowId: project.workflowInstance.workflowId },
      orderBy: { sequence: "asc" },
      include: { tasks: true },
    });
    for (const stage of stages.slice(2, 8)) {
      const version = await submitFixture(
        project,
        stage,
        definition,
        stage.sequence === 8 ? "REVISION_REQUIRED" : "APPROVED",
      );
      if (stage.sequence === 4 && stage.milestoneType === "DEFENSE_ELIGIBILITY")
        await completedProposal(
          project,
          definition,
          stage,
          version,
          context.catalog.find((p) => p.code === definition.code),
        );
    }
    // Leave final eligibility unapproved so the real professor/Dean scheduling process can be demonstrated.
  }
  await writeAccounts(context);
}

async function verify(context) {
  await loadServices();
  const data = await roots();
  assertOwnedRoots(data);
  if (
    data.users.length !== 56 ||
    data.projects.length !== 8 ||
    data.workflows.length !== 4 ||
    data.types.length !== 4 ||
    data.workspaces.length !== 8
  )
    throw new Error(
      "The expected 56 accounts, 8 groups, and 4 workflows were not found.",
    );
  for (const account of accounts()) {
    const user = data.users.find((u) => u.email === account.email);
    if (
      user.status !== "ACTIVE" ||
      !(await bcrypt.compare(
        demoPassword(PROGRAMS.find((p) => p.code === account.program)),
        user.passwordHash,
      ))
    )
      throw new Error(
        `Demo account credentials are not ready: ${account.email}`,
      );
    const catalog = context.catalog.find((p) => p.code === account.program);
    if (
      user.collegeId !== catalog.collegeId ||
      (account.role !== "DEAN" && user.programId !== catalog.id)
    )
      throw new Error("Demo academic scope mismatch.");
  }
  for (const project of data.projects) {
    const students = project.members.filter((m) =>
      ["LEADER", "MEMBER"].includes(m.projectRole),
    );
    if (
      students.length !== 4 ||
      students.filter((m) => m.projectRole === "LEADER").length !== 1
    )
      throw new Error("Group roster mismatch.");
    const enrollment = await db.workflowEnrollment.count({
      where: {
        workflowId: project.workflowInstance.workflowId,
        userId: { in: students.map((m) => m.userId) },
      },
    });
    if (enrollment !== 4)
      throw new Error("Missing student workflow enrollment.");
    const milestones = await progress(db, project.id);
    if (milestones.length !== 10) throw new Error("Expected ten milestones.");
    if (project.groupName.endsWith(":A")) {
      if (milestones.some((m) => m.completed))
        throw new Error("Group A must start at the beginning.");
    } else {
      if (
        milestones.slice(0, 7).some((m) => !m.completed) ||
        milestones[7].status !== "REVISION_REQUIRED" ||
        milestones[7].completed
      )
        throw new Error(
          "Group B is not at the intended final-manuscript revision milestone.",
        );
      if (await eligibility.currentDefenseEligibility(db, project.id))
        throw new Error(
          "Final defense eligibility must require the normal approval flow.",
        );
      for (const session of project.defenseSessions)
        ledger.assertEvaluationIntegrity(
          (await ledger.loadEvaluationIntegrity(db, session.id)).verification,
        );
      for (const document of project.documents)
        for (const version of document.versions) {
          const { buffer } = await documentService.readStoredVersionFile({
            storageProvider: document.storageProvider,
            storagePath: version.storagePath,
            googleDriveFileId: version.googleDriveFileId,
            expectedSize: version.fileSize,
          });
          if (digest(buffer) !== version.contentChecksum)
            throw new Error("Fixture checksum mismatch.");
        }
    }
  }
  output({
    verified: true,
    target: context.target,
    dataset: DATASET,
    accounts: 56,
    groups: 8,
    workflows: 4,
    proposalDefenses: data.projects.reduce(
      (count, p) => count + p.defenseSessions.length,
      0,
    ),
    finalDefenses:
      "Require revision approval, eligibility and signed Dean letter",
    accountFile: path.join(privateDir, "accounts.csv"),
  });
}

async function cleanupPlan(client = db) {
  const data = await roots(client);
  assertOwnedRoots(data);
  const log = await client.auditLog.findFirst({
    where: {
      entityType: "ProgramDemoDataset",
      entityId: DATASET_ID,
      eventType: "PROGRAM_DEMO_CREATED",
    },
    orderBy: { createdAt: "desc" },
  });
  const manifest = log?.newValues;
  if (Object.values(data).some((rows) => rows.length) && !manifest)
    throw new Error(
      "The immutable dataset manifest is missing; automatic cleanup is unavailable.",
    );
  for (const key of ["users", "types", "workflows", "projects", "workspaces"])
    if (
      data[key].some((row) =>
        key === "users"
          ? !Object.hasOwn(manifest?.users || {}, row.id)
          : !manifest?.[key]?.includes(row.id),
      )
    )
      throw new Error("Demo roots do not match the original dataset manifest.");
  const userIds = data.users.map((u) => u.id),
    projectIds = data.projects.map((p) => p.id),
    workflowIds = data.workflows.map((w) => w.id),
    typeIds = data.types.map((t) => t.id);
  const external = await client.researchProject.count({
    where: {
      id: { notIn: projectIds },
      OR: [
        { createdBy: { in: userIds } },
        { members: { some: { userId: { in: userIds } } } },
        { researchTypeId: { in: typeIds } },
        { workflowInstance: { workflowId: { in: workflowIds } } },
      ],
    },
  });
  const unrelatedWorkflows = await client.workflow.count({
    where: {
      id: { notIn: workflowIds },
      OR: [{ createdBy: { in: userIds } }, { researchTypeId: { in: typeIds } }],
    },
  });
  const unrelatedEnrollment = await client.workflowEnrollment.count({
    where: { workflowId: { in: workflowIds }, userId: { notIn: userIds } },
  });
  const unrelatedWorkspace = await client.researchWorkspace.count({
    where: {
      id: { notIn: data.workspaces.map((w) => w.id) },
      OR: [
        { createdBy: { in: userIds } },
        { members: { some: { userId: { in: userIds } } } },
      ],
    },
  });
  if (
    external ||
    unrelatedWorkflows ||
    unrelatedEnrollment ||
    unrelatedWorkspace
  )
    throw new Error(
      "Demo identities or configuration are linked to unrelated records. Automatic deletion is blocked.",
    );
  const resources = await client.workflowResource.findMany({
    where: { workflowId: { in: workflowIds } },
  });
  const files = [
    ...data.projects.flatMap((p) =>
      p.documents.flatMap((d) =>
        d.versions.map((v) => ({
          provider: d.storageProvider,
          fileId: v.googleDriveFileId,
          storagePath: v.storagePath,
        })),
      ),
    ),
    ...resources.map((r) => ({
      provider: r.googleDriveFileId ? "GOOGLE_DRIVE" : "LOCAL",
      fileId: r.googleDriveFileId,
      storagePath: r.storagePath,
    })),
  ];
  const preview = {
    dataset: DATASET,
    accounts: data.users.length,
    groups: data.projects.length,
    workflows: data.workflows.length,
    workspaces: data.workspaces.length,
    files: files.length,
    auditAndEvaluationHistory: "Retained without modification",
    confirmation: `DELETE:${DATASET}`,
  };
  const previewHash = digest(JSON.stringify({ ids: json(data), files }));
  return {
    data,
    userIds,
    projectIds,
    workflowIds,
    typeIds,
    files,
    preview,
    previewHash,
  };
}

async function cleanup() {
  if (process.env.PROGRAM_DEMO_CLEANUP_CONFIRMATION !== `DELETE:${DATASET}`)
    throw new Error(
      `Set PROGRAM_DEMO_CLEANUP_CONFIRMATION=DELETE:${DATASET} for exact dataset cleanup.`,
    );
  const requestedHash = process.env.PROGRAM_DEMO_CLEANUP_PREVIEW_HASH;
  if (!requestedHash)
    throw new Error(
      "Run cleanup-preview and pass its preview hash before deletion.",
    );
  await loadServices();
  await fs.mkdir(privateDir, { recursive: true });
  const journal = path.join(privateDir, "file-cleanup.json");
  let pending = [];
  try {
    pending = JSON.parse(await fs.readFile(journal, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await db.$transaction(
    async (tx) => {
      await lock(tx);
      const plan = await cleanupPlan(tx);
      if (plan.previewHash !== requestedHash)
        throw new Error(
          "Records changed since the cleanup preview. Preview again.",
        );
      // Persist storage work before committing deletion so an interrupted process can retry file removal.
      pending = [
        ...new Map(
          [...pending, ...plan.files].map((file) => [
            `${file.provider}:${file.fileId}:${file.storagePath}`,
            file,
          ]),
        ).values(),
      ];
      await fs.writeFile(journal, JSON.stringify(pending, null, 2), {
        mode: 0o600,
      });
      const { projectIds, userIds, workflowIds, typeIds, data } = plan;
      await tx.defenseSession.deleteMany({
        where: { researchId: { in: projectIds } },
      });
      await tx.defenseEligibility.deleteMany({
        where: { researchId: { in: projectIds } },
      });
      await tx.documentSignature.deleteMany({
        where: {
          sourceVersion: { document: { researchId: { in: projectIds } } },
        },
      });
      await tx.manuscriptStatusEvent.deleteMany({
        where: { document: { researchId: { in: projectIds } } },
      });
      await tx.taskSubmissionAttempt.deleteMany({
        where: { researchId: { in: projectIds } },
      });
      await tx.taskSubmission.deleteMany({
        where: { researchId: { in: projectIds } },
      });
      await tx.review.deleteMany({
        where: { document: { researchId: { in: projectIds } } },
      });
      await tx.reviewerAssignment.deleteMany({
        where: { researchId: { in: projectIds } },
      });
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
      await tx.researchWorkspace.deleteMany({
        where: { id: { in: data.workspaces.map((w) => w.id) } },
      });
      await tx.researchType.updateMany({
        where: { id: { in: typeIds } },
        data: { workflowId: null },
      });
      await tx.workflowStage.updateMany({
        where: { workflowId: { in: workflowIds } },
        data: { requiredMilestoneId: null },
      });
      await tx.structuredEvaluationTemplate.deleteMany({
        where: { createdBy: { in: userIds } },
      });
      await tx.workflow.deleteMany({ where: { id: { in: workflowIds } } });
      await tx.researchType.deleteMany({ where: { id: { in: typeIds } } });
      await tx.defenseEvent.deleteMany({
        where: {
          code: { in: PROGRAMS.map((p) => `DEMO4-${p.code}-PROPOSAL`) },
          createdBy: { in: userIds },
        },
      });
      await tx.facultyProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.researcherProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await tx.collegeMembership.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
      await tx.auditLog.create({
        data: {
          userId: null,
          action: "DELETE",
          entityType: "ProgramDemoDataset",
          entityId: DATASET_ID,
          eventType: "PROGRAM_DEMO_REMOVED",
          oldValues: json(plan.preview),
        },
      });
    },
    { isolationLevel: "Serializable", timeout: 120000, maxWait: 10000 },
  );
  const remaining = [];
  for (const file of pending) {
    const removed = await documentService.cleanupStoredFile(file.provider, {
      fileId: file.fileId,
      storagePath: file.storagePath,
    });
    if (!removed) remaining.push(file);
  }
  await fs.writeFile(journal, JSON.stringify(remaining, null, 2), {
    mode: 0o600,
  });
  if (remaining.length)
    throw new Error(
      `Demo records removed; ${remaining.length} storage files need cleanup retry. Their exact references remain in the private journal.`,
    );
  output({
    removed: true,
    dataset: DATASET,
    auditAndEvaluationHistory: "Retained",
  });
}

async function main() {
  if (command === "plan") {
    output({
      dataset: DATASET,
      programs: PROGRAMS.map(({ code, college, label }) => ({
        code,
        college,
        label,
      })),
      accounts: 56,
      groups: 8,
      workflows: 4,
      groupA: "Beginning; students 1-4",
      groupB: "Final manuscript revisions; students 5-8",
    });
    return;
  }
  if (
    ![
      "preflight",
      "seed",
      "prepare",
      "verify",
      "inspect",
      "cleanup-preview",
      "cleanup",
      "name-accounts",
    ].includes(command)
  )
    throw new Error(
      "Usage: npm run demo:programs -- <plan|preflight|seed|prepare|verify|inspect|cleanup-preview|cleanup|name-accounts>",
    );
  const context = await configure();
  if (command === "name-accounts") return nameAccounts();
  if (command === "preflight") {
    output({
      target: context.target,
      academicYear: context.year.name,
      programs: context.catalog.map((p) => p.code),
    });
    return;
  }
  if (command === "inspect") {
    const data = await roots();
    output({
      dataset: DATASET,
      target: context.target,
      counts: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v.length]),
      ),
      projects: data.projects.map((p) => ({
        id: p.id,
        group: p.groupName,
        title: p.title,
        status: p.status,
      })),
    });
    return;
  }
  if (command === "cleanup-preview") {
    const plan = await cleanupPlan();
    output({ ...plan.preview, previewHash: plan.previewHash });
    return;
  }
  if (command === "cleanup") return cleanup();
  if (command === "seed") await seedCore(context);
  if (command === "seed" || command === "prepare") await prepare(context);
  await verify(context);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main()
    .catch((error) => {
      console.error(
        String(error.message).replace(
          /postgres(?:ql)?:\/\/[^\s]+/gi,
          "[redacted database URL]",
        ),
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await db?.$disconnect();
    });
