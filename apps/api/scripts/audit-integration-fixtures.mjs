import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const repositoryEnv = fileURLToPath(new URL("../../../.env", import.meta.url));
dotenv.config({ path: repositoryEnv });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required for the read-only fixture audit.");
  process.exit(1);
}

let target;
try {
  target = new URL(connectionString);
} catch {
  console.error("DATABASE_URL is invalid.");
  process.exit(1);
}

const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (
  !["postgres:", "postgresql:"].includes(target.protocol) ||
  !localHosts.has(target.hostname.toLowerCase()) ||
  databaseName !== "advisio_local"
) {
  console.error(
    "This audit is read-only and intentionally restricted to the local advisio_local database.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const OFFICIAL_COLLEGE_CODES = [
  "COA",
  "CEA",
  "CHTM",
  "CIT",
  "CNP",
  "SAS",
  "SBPA",
  "SOE",
];
const VERIFIED_PROGRAM_CODES = [
  "BSA",
  "BSAIS",
  "BSARCH",
  "BSCE",
  "BSCPE",
  "BSIE",
  "BSHM",
  "BSTM",
  "BSIT",
  "BLIS",
  "BSN",
  "BSPH",
  "ABCOMM",
  "BSCRIM",
  "BHS",
  "BSPSYCH",
  "BSBA-MM",
  "BSBA-OM",
  "BEED",
  "BSED-VE-RE",
];

async function main() {
  const report = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");

    const projects = await tx.researchProject.findMany({
      where: {
        OR: [
          {
            title: {
              in: [
                "Isolated immutable manuscript verification",
                "Separate project eligibility boundary",
                "Phase 4 isolated review verification",
              ],
            },
          },
          { groupName: { startsWith: "Phase 3 Fixture" } },
          { groupName: { startsWith: "Phase 4 Group" } },
          { groupName: { startsWith: "Phase 1.5 Foreign Fixture" } },
        ],
      },
      select: {
        id: true,
        title: true,
        groupName: true,
        researchTypeId: true,
        programId: true,
        collegeId: true,
        academicYearId: true,
        createdBy: true,
        workflowInstanceId: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            documents: true,
            taskSubmissions: true,
            taskSubmissionAttempts: true,
            reviewerAssignments: true,
            defenseSessions: true,
            officialCopies: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const [
      colleges,
      programs,
      academicYears,
      users,
      researchTypes,
      workflows,
      officialColleges,
      verifiedPrograms,
    ] = await Promise.all([
      tx.college.findMany({
        where: {
          OR: [
            {
              name: {
                in: ["Phase 3 Isolated College", "Phase 4 Isolated College"],
              },
            },
            { name: { startsWith: "Faculty Profile Adviser College " } },
            { name: { startsWith: "Faculty Profile Other College " } },
          ],
        },
        select: { id: true, code: true, name: true, createdAt: true },
      }),
      tx.program.findMany({
        where: {
          OR: [
            {
              name: {
                in: ["Phase 3 Isolated Program", "Phase 4 Isolated Program"],
              },
            },
            { name: { startsWith: "Faculty Profile Adviser Program " } },
            { name: { startsWith: "Faculty Profile Other Program " } },
          ],
        },
        select: { id: true, collegeId: true, code: true, name: true },
      }),
      tx.academicYear.findMany({
        where: {
          OR: [
            { name: { startsWith: "P3-" } },
            { name: { startsWith: "P4-" } },
          ],
        },
        select: { id: true, name: true, startDate: true, endDate: true },
      }),
      tx.user.findMany({
        where: {
          OR: [
            { email: { endsWith: "@isolated.test" } },
            { email: { endsWith: "@integration.test" } },
          ],
        },
        select: {
          id: true,
          universityId: true,
          email: true,
          collegeId: true,
          programId: true,
          createdAt: true,
        },
      }),
      tx.researchType.findMany({
        where: {
          OR: [
            { code: { startsWith: "P3-MANUSCRIPT-" } },
            { code: { startsWith: "P4-MANUSCRIPT-" } },
          ],
        },
        select: { id: true, code: true, programId: true, workflowId: true },
      }),
      tx.workflow.findMany({
        where: {
          name: {
            in: [
              "Phase 3 Verification Workflow",
              "Phase 4 Verification Workflow",
            ],
          },
        },
        select: {
          id: true,
          name: true,
          researchTypeId: true,
          createdBy: true,
        },
      }),
      tx.college.count({ where: { code: { in: OFFICIAL_COLLEGE_CODES } } }),
      tx.program.count({ where: { code: { in: VERIFIED_PROGRAM_CODES } } }),
    ]);

    const projectIds = projects.map(({ id }) => id);
    const workflowIds = workflows.map(({ id }) => id);
    const userIds = users.map(({ id }) => id);
    const [documents, workflowInstances, workflowTasks, researchMembers] =
      await Promise.all([
        tx.document.findMany({
          where: { researchId: { in: projectIds } },
          select: {
            id: true,
            researchId: true,
            milestoneId: true,
            title: true,
            lifecycleStatus: true,
            createdBy: true,
            versions: {
              select: {
                id: true,
                versionNumber: true,
                fileName: true,
                mimeType: true,
                status: true,
                manuscriptStatus: true,
                isImmutable: true,
                submittedBy: true,
              },
              orderBy: { versionNumber: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        tx.workflowInstance.findMany({
          where: { researchId: { in: projectIds } },
          select: {
            id: true,
            researchId: true,
            workflowId: true,
            currentStageId: true,
          },
        }),
        tx.workflowTask.findMany({
          where: { stage: { workflowId: { in: workflowIds } } },
          select: {
            id: true,
            stageId: true,
            title: true,
            allowedFileTypes: true,
            stage: { select: { workflowId: true } },
          },
        }),
        tx.researchMember.findMany({
          where: { researchId: { in: projectIds } },
          select: {
            id: true,
            researchId: true,
            userId: true,
            projectRole: true,
            leftAt: true,
          },
        }),
      ]);

    const phase3ProjectIds = new Set(
      projects
        .filter(
          ({ groupName }) =>
            groupName?.startsWith("Phase 3 Fixture") ||
            groupName?.startsWith("Phase 1.5 Foreign Fixture"),
        )
        .map(({ id }) => id),
    );
    const phase3UserIds = new Set(
      users
        .filter(({ email }) => email.startsWith("phase3-"))
        .map(({ id }) => id),
    );
    const phase3WorkflowIds = new Set(
      workflows
        .filter(({ name }) => name === "Phase 3 Verification Workflow")
        .map(({ id }) => id),
    );
    const phase3Documents = documents.filter(({ researchId }) =>
      phase3ProjectIds.has(researchId),
    );
    const phase3DocumentIds = new Set(phase3Documents.map(({ id }) => id));
    const phase3DocumentVersionIds = new Set(
      phase3Documents.flatMap(({ versions }) => versions.map(({ id }) => id)),
    );
    const documentIds = documents.map(({ id }) => id);
    const documentVersionIds = documents.flatMap(({ versions }) =>
      versions.map(({ id }) => id),
    );
    const [
      taskSubmissions,
      taskSubmissionAttempts,
      reviewerAssignments,
      reviews,
      defenseSessions,
      notifications,
      auditLogs,
    ] = await Promise.all([
      tx.taskSubmission.findMany({
        where: { researchId: { in: projectIds } },
        select: {
          id: true,
          researchId: true,
          taskId: true,
          documentId: true,
          documentVersionId: true,
          submittedBy: true,
          status: true,
        },
      }),
      tx.taskSubmissionAttempt.findMany({
        where: { researchId: { in: projectIds } },
        select: {
          id: true,
          taskSubmissionId: true,
          researchId: true,
          taskId: true,
          documentId: true,
          documentVersionId: true,
          submittedBy: true,
          attemptNumber: true,
          status: true,
        },
      }),
      tx.reviewerAssignment.findMany({
        where: { researchId: { in: projectIds } },
        select: {
          id: true,
          researchId: true,
          documentId: true,
          documentVersionId: true,
          reviewerId: true,
          assignedById: true,
          reviewType: true,
          status: true,
        },
      }),
      tx.review.findMany({
        where: { documentId: { in: documentIds } },
        select: {
          id: true,
          assignmentId: true,
          documentId: true,
          documentVersionId: true,
          reviewerId: true,
          status: true,
          recommendation: true,
        },
      }),
      tx.defenseSession.findMany({
        where: { researchId: { in: projectIds } },
        select: { id: true, researchId: true, status: true, decision: true },
      }),
      tx.notification.findMany({
        where: { recipientId: { in: userIds } },
        select: {
          id: true,
          recipientId: true,
          type: true,
          entityType: true,
          entityId: true,
        },
      }),
      tx.auditLog.findMany({
        where: {
          OR: [
            { userId: { in: userIds } },
            {
              entityId: {
                in: [...projectIds, ...documentIds, ...documentVersionIds],
              },
            },
          ],
        },
        select: {
          id: true,
          userId: true,
          action: true,
          entityType: true,
          entityId: true,
        },
      }),
    ]);

    return {
      target: {
        databaseName,
        host: target.hostname,
        port: target.port || "5432",
        mode: "READ ONLY",
      },
      suspectedFixtureRoots: {
        projects,
        colleges,
        programs,
        academicYears,
        users,
        researchTypes,
        workflows,
      },
      dependentRecords: {
        workflowInstances,
        workflowTasks,
        researchMembers,
        documents,
        taskSubmissions,
        taskSubmissionAttempts,
        reviewerAssignments,
        reviews,
        defenseSessions,
        notifications,
        auditLogs,
      },
      summary: {
        officialCatalog: {
          colleges: officialColleges,
          verifiedPrograms,
        },
        projects: projects.length,
        projectsByFamily: {
          phase3: projects.filter(({ groupName }) =>
            groupName?.startsWith("Phase 3 Fixture"),
          ).length,
          phase15Foreign: projects.filter(({ groupName }) =>
            groupName?.startsWith("Phase 1.5 Foreign Fixture"),
          ).length,
          phase4: projects.filter(({ groupName }) =>
            groupName?.startsWith("Phase 4 Group"),
          ).length,
        },
        colleges: colleges.length,
        programs: programs.length,
        academicYears: academicYears.length,
        users: users.length,
        researchTypes: researchTypes.length,
        workflows: workflows.length,
        workflowInstances: workflowInstances.length,
        workflowTasks: workflowTasks.length,
        researchMembers: researchMembers.length,
        documents: documents.length,
        documentVersions: documentVersionIds.length,
        taskSubmissions: taskSubmissions.length,
        taskSubmissionAttempts: taskSubmissionAttempts.length,
        reviewerAssignments: reviewerAssignments.length,
        reviews: reviews.length,
        defenseSessions: defenseSessions.length,
        notifications: notifications.length,
        auditLogs: auditLogs.length,
        officialCopies: projects.reduce(
          (total, project) => total + project._count.officialCopies,
          0,
        ),
        phase3Family: {
          projects: phase3ProjectIds.size,
          colleges: colleges.filter(({ code }) => code.startsWith("P3")).length,
          programs: programs.filter(({ code }) => code.startsWith("P3IT"))
            .length,
          academicYears: academicYears.filter(({ name }) =>
            name.startsWith("P3-"),
          ).length,
          users: phase3UserIds.size,
          researchTypes: researchTypes.filter(({ code }) =>
            code.startsWith("P3-MANUSCRIPT-"),
          ).length,
          workflows: phase3WorkflowIds.size,
          workflowInstances: workflowInstances.filter(({ researchId }) =>
            phase3ProjectIds.has(researchId),
          ).length,
          workflowTasks: workflowTasks.filter(({ stage }) =>
            phase3WorkflowIds.has(stage.workflowId),
          ).length,
          researchMembers: researchMembers.filter(({ researchId }) =>
            phase3ProjectIds.has(researchId),
          ).length,
          documents: phase3Documents.length,
          documentVersions: phase3DocumentVersionIds.size,
          taskSubmissions: taskSubmissions.filter(({ researchId }) =>
            phase3ProjectIds.has(researchId),
          ).length,
          taskSubmissionAttempts: taskSubmissionAttempts.filter(
            ({ researchId }) => phase3ProjectIds.has(researchId),
          ).length,
          reviewerAssignments: reviewerAssignments.filter(({ researchId }) =>
            phase3ProjectIds.has(researchId),
          ).length,
          reviews: reviews.filter(({ documentId }) =>
            phase3DocumentIds.has(documentId),
          ).length,
          defenseSessions: defenseSessions.filter(({ researchId }) =>
            phase3ProjectIds.has(researchId),
          ).length,
          notifications: notifications.filter(({ recipientId }) =>
            phase3UserIds.has(recipientId),
          ).length,
          auditLogs: auditLogs.filter(
            ({ userId, entityId }) =>
              (userId !== null && phase3UserIds.has(userId)) ||
              (entityId !== null &&
                (phase3ProjectIds.has(entityId) ||
                  phase3DocumentIds.has(entityId) ||
                  phase3DocumentVersionIds.has(entityId))),
          ).length,
          officialCopies: projects
            .filter(({ id }) => phase3ProjectIds.has(id))
            .reduce(
              (total, project) => total + project._count.officialCopies,
              0,
            ),
        },
      },
      proposedDeletionOrder: [
        "audit logs owned by the exact fixture users/entity IDs",
        "clear tracked project-to-workflow-instance links",
        "tracked workflow instances",
        "tracked projects (cascades only their dependent workflow records)",
        "clear tracked research-type workflow links",
        "tracked workflows and research types",
        "tracked test users and role links",
        "tracked academic years, programs, and colleges",
      ],
      warning:
        "Dry run only. No records were changed. Any officialCopies count above zero requires manual review and blocks automated cleanup.",
    };
  });

  console.log(
    JSON.stringify(
      process.argv.includes("--summary")
        ? {
            target: report.target,
            summary: report.summary,
            warning: report.warning,
          }
        : report,
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
