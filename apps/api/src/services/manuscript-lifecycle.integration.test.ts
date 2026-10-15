import crypto from "node:crypto";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { ManuscriptLifecycleStatus, prisma } from "../lib/prisma.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { documentAccessService } from "./document-access.service.js";
import { googleDriveService } from "./google-drive.service.js";
import {
  ManuscriptWorkflowError,
  manuscriptLifecycleService,
} from "./manuscript-lifecycle.service.js";
import { storageHierarchyService } from "./storage-hierarchy.service.js";
import { reviewerAssignmentService } from "./reviewer-assignment.service.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

function authenticated(
  user: { id: string; email: string; universityId: string },
  roles: string[],
  collegeId: string,
  programId: string,
): AuthenticatedUser {
  return {
    ...user,
    roles: roles as AuthenticatedUser["roles"],
    permissions: [],
    collegeId,
    programId,
  };
}

databaseDescribe("Phase 3 manuscript workflow with isolated PostgreSQL fixtures", () => {
  const fixtureSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  const sourceFileId = `phase3-source-${fixtureSuffix}`;
  let student: AuthenticatedUser;
  let outsider: AuthenticatedUser;
  let adviser: AuthenticatedUser;
  let professor: AuthenticatedUser;
  let collegeId: string;
  let programId: string;
  let projectId: string;
  let documentId: string;
  let inaccessibleDocumentId: string;
  let milestoneId: string;
  let taskId: string;
  const sourcePdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n",
  );

  beforeAll(async () => {
    const college = await prisma.college.create({
      data: { code: `P3${fixtureSuffix}`, name: "Phase 3 Isolated College" },
    });
    collegeId = college.id;
    const program = await prisma.program.create({
      data: {
        collegeId,
        code: `P3IT${fixtureSuffix}`,
        name: "Phase 3 Isolated Program",
      },
    });
    programId = program.id;
    const academicYear = await prisma.academicYear.create({
      data: {
        name: `P3-${fixtureSuffix}`,
        startDate: new Date("2098-06-01T00:00:00.000Z"),
        endDate: new Date("2099-05-31T00:00:00.000Z"),
      },
    });
    const roleNames = [
      "RESEARCHER",
      "ADVISER",
      "RESEARCH_COORDINATOR",
    ] as const;
    await prisma.role.createMany({
      data: roleNames.map((name) => ({ name })),
      skipDuplicates: true,
    });
    const storedRoles = await prisma.role.findMany({
      where: { name: { in: [...roleNames] } },
    });
    const roleByName = new Map(storedRoles.map((role) => [role.name, role]));
    const roles = roleNames.map((name) => roleByName.get(name)!);
    const createUser = (suffix: string) =>
      prisma.user.create({
        data: {
          universityId: `P3-${fixtureSuffix}-${suffix}`,
          email: `phase3-${fixtureSuffix.toLowerCase()}-${suffix.toLowerCase()}@isolated.test`,
          firstName: suffix,
          lastName: "Fixture",
          status: "ACTIVE",
          collegeId,
          programId,
        },
      });
    const [studentRecord, outsiderRecord, adviserRecord, professorRecord] =
      await Promise.all([
        createUser("Student"),
        createUser("Outsider"),
        createUser("Adviser"),
        createUser("Professor"),
      ]);
    await prisma.userRole.createMany({
      data: [
        { userId: studentRecord.id, roleId: roles[0].id },
        { userId: outsiderRecord.id, roleId: roles[0].id },
        { userId: adviserRecord.id, roleId: roles[1].id },
        { userId: professorRecord.id, roleId: roles[2].id },
      ],
    });
    student = authenticated(
      studentRecord,
      ["RESEARCHER"],
      collegeId,
      programId,
    );
    outsider = authenticated(
      outsiderRecord,
      ["RESEARCHER"],
      collegeId,
      programId,
    );
    adviser = authenticated(
      adviserRecord,
      ["ADVISER"],
      collegeId,
      programId,
    );
    professor = authenticated(
      professorRecord,
      ["RESEARCH_COORDINATOR"],
      collegeId,
      programId,
    );

    const researchType = await prisma.researchType.create({
      data: {
        programId,
        name: "Phase 3 Manuscript",
        code: `P3-MANUSCRIPT-${fixtureSuffix}`,
      },
    });
    const workflow = await prisma.workflow.create({
      data: {
        researchTypeId: researchType.id,
        name: "Phase 3 Verification Workflow",
        status: "PUBLISHED",
        createdBy: professor.id,
      },
    });
    await prisma.researchType.update({
      where: { id: researchType.id },
      data: { workflowId: workflow.id },
    });
    const milestone = await prisma.workflowStage.create({
      data: {
        workflowId: workflow.id,
        name: "Chapter Review",
        sequence: 1,
        responsibleRoleId: roles[2].id,
        requiresApproval: true,
      },
    });
    milestoneId = milestone.id;
    const task = await prisma.workflowTask.create({
      data: { stageId: milestone.id, title: "Submit manuscript", sequence: 1 },
    });
    taskId = task.id;
    const project = await prisma.researchProject.create({
      data: {
        researchTypeId: researchType.id,
        programId,
        collegeId,
        academicYearId: academicYear.id,
        title: "Isolated immutable manuscript verification",
        groupName: "Phase 3 Fixture Group",
        participationMode: "GROUP",
        createdBy: student.id,
      },
    });
    projectId = project.id;
    const workflowInstance = await prisma.workflowInstance.create({
      data: {
        researchId: project.id,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        currentStageId: milestone.id,
      },
    });
    await prisma.researchProject.update({
      where: { id: project.id },
      data: { workflowInstanceId: workflowInstance.id },
    });
    await prisma.researchMember.createMany({
      data: [
        { researchId: project.id, userId: student.id, projectRole: "LEADER" },
        { researchId: project.id, userId: adviser.id, projectRole: "ADVISER" },
      ],
    });
    const document = await prisma.document.create({
      data: {
        researchId: project.id,
        milestoneId: milestone.id,
        documentType: "MANUSCRIPT",
        title: "Research Manuscript",
        currentVersion: 0,
        liveDocumentUrl:
          `https://docs.google.com/document/d/${sourceFileId}/edit`,
        liveExternalFileId: sourceFileId,
        createdBy: student.id,
      },
    });
    documentId = document.id;
    const inaccessibleDocument = await prisma.document.create({
      data: {
        researchId: project.id,
        milestoneId: milestone.id,
        documentType: "MANUSCRIPT",
        title: "Inaccessible Research Manuscript",
        currentVersion: 0,
        liveDocumentUrl:
          `https://docs.google.com/document/d/phase3-inaccessible-${fixtureSuffix}/edit`,
        liveExternalFileId: `phase3-inaccessible-${fixtureSuffix}`,
        createdBy: student.id,
      },
    });
    inaccessibleDocumentId = inaccessibleDocument.id;

    vi.spyOn(storageHierarchyService, "resolveFolder").mockResolvedValue(
      "isolated-submissions-folder",
    );
    vi.spyOn(googleDriveService, "exportImmutablePdf").mockResolvedValue({
      buffer: sourcePdf,
      fileName: "Research Manuscript.pdf",
      mimeType: "application/pdf",
      sourceMimeType: "application/vnd.google-apps.document",
      sourceModifiedAt: new Date("2026-10-13T08:00:00.000Z"),
    });
    let uploadNumber = 0;
    vi.spyOn(googleDriveService, "uploadFile").mockImplementation(
      async (options) => {
        uploadNumber += 1;
        return {
          fileId: `p3-${fixtureSuffix}-snapshot-${uploadNumber}`,
          fileName: options.fileName,
          mimeType: options.mimeType,
          sizeBytes: options.buffer.length,
          webViewLink: `/api/documents/files/p3-${fixtureSuffix}-snapshot-${uploadNumber}`,
          webContentLink: `/api/documents/files/p3-${fixtureSuffix}-snapshot-${uploadNumber}?download=1`,
          storagePath: `google-drive://p3-${fixtureSuffix}-snapshot-${uploadNumber}`,
        };
      },
    );
    vi.spyOn(googleDriveService, "deleteStoredFile").mockResolvedValue(true);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
  });

  it("submits, authorizes, transitions, resubmits, and preserves exact versions", async () => {
    await expect(
      manuscriptLifecycleService.submit({
        documentId,
        milestoneId,
        taskId,
        idempotencyKey: "phase3-outsider-key-0001",
        user: outsider,
      }),
    ).rejects.toMatchObject<Partial<ManuscriptWorkflowError>>({
      statusCode: 403,
      code: "PROJECT_MEMBERSHIP_REQUIRED",
    });

    vi.mocked(googleDriveService.exportImmutablePdf).mockRejectedValueOnce(
      new Error("The connected Google account is not allowed to export this document."),
    );
    await expect(
      manuscriptLifecycleService.submit({
        documentId: inaccessibleDocumentId,
        milestoneId,
        taskId,
        idempotencyKey: "phase3-inaccessible-key-01",
        user: student,
      }),
    ).rejects.toMatchObject<Partial<ManuscriptWorkflowError>>({
      statusCode: 422,
      code: "GOOGLE_DOCUMENT_NOT_EXPORTABLE",
    });
    const inaccessibleAfterFailure = await prisma.document.findUniqueOrThrow({
      where: { id: inaccessibleDocumentId },
      include: { versions: true },
    });
    expect(inaccessibleAfterFailure.lifecycleStatus).toBe("DRAFT");
    expect(inaccessibleAfterFailure.pendingSubmissionKey).toBeNull();
    expect(inaccessibleAfterFailure.versions).toHaveLength(0);

    const first = await manuscriptLifecycleService.submit({
      documentId,
      milestoneId,
      taskId,
      idempotencyKey: "phase3-submission-key-0001",
      note: "Ready for adviser review.",
      user: student,
    });
    expect(first.duplicate).toBe(false);
    expect(first.version.versionNumber).toBe(1);
    expect(first.version.isImmutable).toBe(true);
    expect(first.version.contentChecksum).toBe(
      crypto.createHash("sha256").update(sourcePdf).digest("hex"),
    );
    expect(first.version.milestoneId).toBe(milestoneId);
    expect(first.version.submittedBy).toBe(student.id);

    const duplicate = await manuscriptLifecycleService.submit({
      documentId,
      milestoneId,
      taskId,
      idempotencyKey: "phase3-submission-key-0001",
      user: student,
    });
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.version.id).toBe(first.version.id);
    expect(googleDriveService.exportImmutablePdf).toHaveBeenCalledTimes(2);

    const submittedDocument = await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
    });
    expect(submittedDocument.lifecycleStatus).toBe("IN_REVIEW");
    expect(submittedDocument.liveDocumentUrl).toContain(sourceFileId);
    expect(submittedDocument.liveExternalFileId).toBe(sourceFileId);
    const taskSubmission = await prisma.taskSubmission.findUniqueOrThrow({
      where: { researchId_taskId: { researchId: projectId, taskId } },
    });
    expect(taskSubmission.documentVersionId).toBe(first.version.id);

    await expect(
      prisma.documentVersion.update({
        where: { id: first.version.id },
        data: { fileName: "tampered.pdf" },
      }),
    ).rejects.toThrow(/immutable manuscript snapshot/i);

    const studentAccess = await documentAccessService.forResearch(
      student,
      projectId,
    );
    const outsiderAccess = await documentAccessService.forResearch(
      outsider,
      projectId,
    );
    const adviserAccess = await documentAccessService.forResearch(
      adviser,
      projectId,
    );
    const professorAccess = await documentAccessService.forResearch(
      professor,
      projectId,
    );
    expect(studentAccess.canSubmitManuscript).toBe(true);
    expect(outsiderAccess.canView).toBe(false);
    expect(adviserAccess.reasons).toContain("assigned-adviser");
    expect(professorAccess.reasons).toContain("assigned-workflow-professor");
    expect(await documentAccessService.canViewVersion(student, first.version.id)).toBe(
      true,
    );
    expect(
      await documentAccessService.canViewVersion(outsider, first.version.id),
    ).toBe(false);

    const adviserAssignment = await prisma.reviewerAssignment.findFirstOrThrow({
      where: {
        documentVersionId: first.version.id,
        reviewerId: adviser.id,
        status: "ACTIVE",
      },
    });
    await reviewerAssignmentService.decide({
      assignmentId: adviserAssignment.id,
      recommendation: "MAJOR_REVISION",
      overallComment: "Revise the methodology section.",
      user: adviser,
    });
    await expect(
      manuscriptLifecycleService.transition({
        documentId,
        targetStatus: ManuscriptLifecycleStatus.APPROVED,
        user: adviser,
      }),
    ).rejects.toMatchObject({ code: "FORMAL_REVIEW_ASSIGNMENT_REQUIRED" });

    const second = await manuscriptLifecycleService.submit({
      documentId,
      milestoneId,
      taskId,
      idempotencyKey: "phase3-submission-key-0002",
      note: "Methodology revised.",
      user: student,
    });
    expect(second.version.versionNumber).toBe(2);
    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0].fileName).toBe(first.version.fileName);
    expect(versions[0].contentChecksum).toBe(first.version.contentChecksum);
    expect(versions[0].status).toBe("SUPERSEDED");
    expect(versions[1].status).toBe("ACTIVE");
    expect(versions[1].manuscriptStatus).toBe("IN_REVIEW");
    expect(await prisma.manuscriptStatusEvent.count({ where: { documentId } })).toBe(
      5,
    );
  });
});
