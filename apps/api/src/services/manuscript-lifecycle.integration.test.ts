import crypto from "node:crypto";
import { Readable } from "node:stream";
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
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";
import { reviewerAssignmentService } from "./reviewer-assignment.service.js";
import {
  submitStoredTaskVersion,
  uploadTaskSubmission,
} from "./task-submission-upload.service.js";
import { getTaskSubmissionOptions } from "./submission.service.js";

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

databaseDescribe(
  "Phase 3 manuscript workflow with isolated PostgreSQL fixtures",
  () => {
    const fixtureSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
    const fixture = createIntegrationFixtureScope(
      `phase3-${fixtureSuffix.toLowerCase()}`,
    );
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
    let foreignDocumentId: string;
    let milestoneId: string;
    let taskId: string;
    const sourcePdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n",
    );

    beforeAll(async () => {
      await assertIsolatedIntegrationDatabase(prisma);
      fixture.databaseVerified = true;
      const college = await prisma.college.create({
        data: { code: `P3${fixtureSuffix}`, name: "Phase 3 Isolated College" },
      });
      fixture.collegeIds.push(college.id);
      collegeId = college.id;
      const program = await prisma.program.create({
        data: {
          collegeId,
          code: `P3IT${fixtureSuffix}`,
          name: "Phase 3 Isolated Program",
        },
      });
      fixture.programIds.push(program.id);
      programId = program.id;
      const academicYear = await prisma.academicYear.create({
        data: {
          name: `P3-${fixtureSuffix}`,
          startDate: new Date("2098-06-01T00:00:00.000Z"),
          endDate: new Date("2099-05-31T00:00:00.000Z"),
        },
      });
      fixture.academicYearIds.push(academicYear.id);
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
      const createUser = async (suffix: string) => {
        const user = await prisma.user.create({
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
        fixture.userIds.push(user.id);
        return user;
      };
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
      adviser = authenticated(adviserRecord, ["ADVISER"], collegeId, programId);
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
      fixture.researchTypeIds.push(researchType.id);
      const workflow = await prisma.workflow.create({
        data: {
          researchTypeId: researchType.id,
          name: "Phase 3 Verification Workflow",
          status: "PUBLISHED",
          createdBy: professor.id,
        },
      });
      fixture.workflowIds.push(workflow.id);
      await prisma.workflowEnrollment.create({
        data: { workflowId: workflow.id, userId: student.id, status: "ACTIVE" },
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
        data: {
          stageId: milestone.id,
          title: "Submit manuscript",
          sequence: 1,
        },
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
      fixture.projectIds.push(project.id);
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
          {
            researchId: project.id,
            userId: outsider.id,
            projectRole: "MEMBER",
            leftAt: new Date("2026-10-01T00:00:00.000Z"),
          },
          {
            researchId: project.id,
            userId: adviser.id,
            projectRole: "ADVISER",
          },
        ],
      });
      const document = await prisma.document.create({
        data: {
          researchId: project.id,
          milestoneId: milestone.id,
          documentType: "MANUSCRIPT",
          title: "Research Manuscript",
          currentVersion: 0,
          liveDocumentUrl: `https://docs.google.com/document/d/${sourceFileId}/edit`,
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
          liveDocumentUrl: `https://docs.google.com/document/d/phase3-inaccessible-${fixtureSuffix}/edit`,
          liveExternalFileId: `phase3-inaccessible-${fixtureSuffix}`,
          createdBy: student.id,
        },
      });
      inaccessibleDocumentId = inaccessibleDocument.id;

      const foreignProject = await prisma.researchProject.create({
        data: {
          researchTypeId: researchType.id,
          programId,
          collegeId,
          academicYearId: academicYear.id,
          title: "Separate project eligibility boundary",
          groupName: "Phase 1.5 Foreign Fixture Group",
          participationMode: "GROUP",
          createdBy: student.id,
        },
      });
      fixture.projectIds.push(foreignProject.id);
      const foreignWorkflowInstance = await prisma.workflowInstance.create({
        data: {
          researchId: foreignProject.id,
          workflowId: workflow.id,
          workflowVersion: workflow.version,
          currentStageId: milestone.id,
        },
      });
      await prisma.researchProject.update({
        where: { id: foreignProject.id },
        data: { workflowInstanceId: foreignWorkflowInstance.id },
      });
      await prisma.researchMember.create({
        data: {
          researchId: foreignProject.id,
          userId: student.id,
          projectRole: "LEADER",
        },
      });
      const foreignDocument = await prisma.document.create({
        data: {
          researchId: foreignProject.id,
          milestoneId: milestone.id,
          documentType: "MANUSCRIPT",
          title: "Foreign project manuscript",
          currentVersion: 0,
          liveDocumentUrl: `https://docs.google.com/document/d/phase15-foreign-${fixtureSuffix}/edit`,
          liveExternalFileId: `phase15-foreign-${fixtureSuffix}`,
          createdBy: student.id,
        },
      });
      foreignDocumentId = foreignDocument.id;

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
      vi.spyOn(googleDriveService, "getFileMetadata").mockResolvedValue({
        id: `p3-${fixtureSuffix}-working-file`,
        name: "stored-working-manuscript.pdf",
        mimeType: "application/pdf",
        size: String(sourcePdf.length),
        modifiedTime: "2026-10-13T09:00:00.000Z",
      });
      vi.spyOn(googleDriveService, "getFileStream").mockResolvedValue({
        data: Readable.from([sourcePdf]),
      } as any);
    });

    afterAll(async () => {
      const teardownErrors: unknown[] = [];
      vi.restoreAllMocks();
      try {
        await cleanupIntegrationFixture(prisma, fixture);
      } catch (error) {
        teardownErrors.push(error);
      }
      try {
        await prisma.$disconnect();
      } catch (error) {
        teardownErrors.push(error);
      }
      if (teardownErrors.length > 0) {
        throw new AggregateError(
          teardownErrors,
          `Integration fixture cleanup failed for ${fixture.marker}.`,
        );
      }
    });

    it("denies a revoked workflow participant who remains a project member", async () => {
      const where = {
        workflowId_userId: { workflowId: fixture.workflowIds[0], userId: student.id },
      };
      await prisma.workflowEnrollment.update({ where, data: { status: "REVOKED" } });
      try {
        expect(await prisma.researchMember.findFirst({
          where: { researchId: projectId, userId: student.id, leftAt: null },
        })).toMatchObject({ projectRole: "LEADER" });
        await expect(getTaskSubmissionOptions({
          user: student, researchId: projectId, taskId,
        })).rejects.toMatchObject({ statusCode: 403, code: "WORKFLOW_ENROLLMENT_REQUIRED" });
      } finally {
        await prisma.workflowEnrollment.update({ where, data: { status: "ACTIVE" } });
      }
    });

    it("submits, authorizes, transitions, resubmits, and preserves exact versions", async () => {
      const initialOptions = await getTaskSubmissionOptions({
        user: student,
        researchId: projectId,
        taskId,
      });
      expect(initialOptions.task).toMatchObject({
        id: taskId,
        milestoneId,
        allowedFileTypes: ["PDF", "DOCX"],
      });
      expect(initialOptions.availability).toMatchObject({
        canSubmit: true,
        mode: "INITIAL",
        currentStatus: null,
      });
      expect(initialOptions.options).toContainEqual(
        expect.objectContaining({
          kind: "GOOGLE_DOC_PDF_SNAPSHOT",
          document: expect.objectContaining({ id: documentId }),
          snapshot: expect.objectContaining({
            createsImmutableVersion: true,
            requiresExportVerification: true,
          }),
        }),
      );
      expect(
        initialOptions.options.some(
          (option) => option.document.id === foreignDocumentId,
        ),
      ).toBe(false);
      await expect(
        getTaskSubmissionOptions({
          user: outsider,
          researchId: projectId,
          taskId,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "PROJECT_MEMBERSHIP_REQUIRED",
      });
      await expect(
        getTaskSubmissionOptions({
          user: student,
          researchId: projectId,
          taskId: crypto.randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "INVALID_TASK" });

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
        new Error(
          "The connected Google account is not allowed to export this document.",
        ),
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

      await prisma.workflowTask.update({
        where: { id: taskId },
        data: { allowedFileTypes: "DOCX" },
      });
      const docxOnlyOptions = await getTaskSubmissionOptions({
        user: student,
        researchId: projectId,
        taskId,
      });
      expect(docxOnlyOptions.options).toEqual([]);
      expect(docxOnlyOptions.unavailableOptionReasons).toContainEqual(
        expect.objectContaining({ code: "FILE_TYPE_NOT_ALLOWED" }),
      );
      await expect(
        manuscriptLifecycleService.submit({
          documentId,
          milestoneId,
          taskId,
          idempotencyKey: "phase3-format-check-key-01",
          user: student,
        }),
      ).rejects.toMatchObject({
        statusCode: 415,
        code: "FILE_TYPE_NOT_ALLOWED",
      });
      await prisma.workflowTask.update({
        where: { id: taskId },
        data: { allowedFileTypes: "PDF,DOCX" },
      });

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

      const underReviewOptions = await getTaskSubmissionOptions({
        user: student,
        researchId: projectId,
        taskId,
      });
      expect(underReviewOptions.availability).toMatchObject({
        canSubmit: false,
        currentStatus: "UNDER_REVIEW",
      });
      expect(underReviewOptions.options).toEqual([]);
      await expect(
        manuscriptLifecycleService.submit({
          documentId,
          milestoneId,
          taskId,
          idempotencyKey: "phase15-state-changed-key-01",
          user: student,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "INVALID_LIFECYCLE_STATE",
      });

      await expect(
        manuscriptLifecycleService.submit({
          documentId,
          milestoneId,
          taskId,
          idempotencyKey: "phase3-submission-key-0001",
          user: outsider,
        }),
      ).rejects.toMatchObject<Partial<ManuscriptWorkflowError>>({
        statusCode: 403,
        code: "PROJECT_MEMBERSHIP_REQUIRED",
      });

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
      expect(
        await documentAccessService.canViewVersion(student, first.version.id),
      ).toBe(true);
      expect(
        await documentAccessService.canViewVersion(outsider, first.version.id),
      ).toBe(false);

      const adviserAssignment =
        await prisma.reviewerAssignment.findFirstOrThrow({
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

      const revisionOptions = await getTaskSubmissionOptions({
        user: student,
        researchId: projectId,
        taskId,
      });
      expect(revisionOptions.availability).toMatchObject({
        canSubmit: true,
        mode: "REVISION",
        currentStatus: "REVISION_REQUIRED",
      });
      expect(revisionOptions.options).toContainEqual(
        expect.objectContaining({
          kind: "GOOGLE_DOC_PDF_SNAPSHOT",
          document: expect.objectContaining({ id: documentId }),
        }),
      );

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
      expect(
        await prisma.manuscriptStatusEvent.count({ where: { documentId } }),
      ).toBe(5);

      const uploadTask = await prisma.workflowTask.create({
        data: {
          stageId: milestoneId,
          title: "Upload supporting manuscript",
          sequence: 2,
          allowedFileTypes: "PDF",
        },
      });
      const uploaded = await uploadTaskSubmission({
        user: student,
        researchId: projectId,
        taskId: uploadTask.id,
        clientKey: "phase1-direct-upload-key-01",
        title: "Supporting manuscript",
        file: {
          buffer: sourcePdf,
          originalname: "supporting-manuscript.pdf",
          mimetype: "application/pdf",
        },
      });
      expect(uploaded.duplicate).toBe(false);
      expect(uploaded.version.isImmutable).toBe(true);
      expect(uploaded.version.submissionKey).toHaveLength(64);
      expect(uploaded.version.contentChecksum).toBe(
        crypto.createHash("sha256").update(sourcePdf).digest("hex"),
      );
      expect(uploaded.version.snapshotCreatedAt).toBeInstanceOf(Date);
      expect(uploaded.submission.status).toBe("UNDER_REVIEW");

      const uploadReplay = await uploadTaskSubmission({
        user: student,
        researchId: projectId,
        taskId: uploadTask.id,
        clientKey: "phase1-direct-upload-key-01",
        title: "Supporting manuscript",
        file: {
          buffer: sourcePdf,
          originalname: "supporting-manuscript.pdf",
          mimetype: "application/pdf",
        },
      });
      expect(uploadReplay.duplicate).toBe(true);
      expect(uploadReplay.version.id).toBe(uploaded.version.id);

      const storedTask = await prisma.workflowTask.create({
        data: {
          stageId: milestoneId,
          title: "Link stored manuscript",
          sequence: 3,
          allowedFileTypes: "PDF",
        },
      });
      const storedDocument = await prisma.document.create({
        data: {
          researchId: projectId,
          milestoneId,
          documentType: "MANUSCRIPT",
          title: "Stored working manuscript",
          currentVersion: 1,
          storageProvider: "GOOGLE_DRIVE",
          externalFileId: `p3-${fixtureSuffix}-working-file`,
          createdBy: student.id,
        },
      });
      const workingVersion = await prisma.documentVersion.create({
        data: {
          documentId: storedDocument.id,
          milestoneId,
          versionNumber: 1,
          fileName: "stored-working-manuscript.pdf",
          mimeType: "application/pdf",
          fileSize: BigInt(sourcePdf.length),
          storagePath: `/api/documents/files/p3-${fixtureSuffix}-working-file`,
          googleDriveFileId: `p3-${fixtureSuffix}-working-file`,
          uploadedBy: student.id,
        },
      });
      const milestoneContext = await prisma.workflowStage.findUniqueOrThrow({
        where: { id: milestoneId },
        select: { workflowId: true, responsibleRoleId: true },
      });
      const otherMilestone = await prisma.workflowStage.create({
        data: {
          workflowId: milestoneContext.workflowId,
          name: "Other manuscript milestone",
          sequence: 99,
          responsibleRoleId: milestoneContext.responsibleRoleId,
        },
      });
      const mismatchedVersion = await prisma.documentVersion.create({
        data: {
          documentId: storedDocument.id,
          milestoneId: otherMilestone.id,
          versionNumber: 2,
          fileName: "wrong-milestone-manuscript.pdf",
          mimeType: "application/pdf",
          fileSize: BigInt(sourcePdf.length),
          storagePath: `/api/documents/files/p3-${fixtureSuffix}-wrong-milestone`,
          googleDriveFileId: `p3-${fixtureSuffix}-wrong-milestone`,
          uploadedBy: student.id,
        },
      });
      const storedOptions = await getTaskSubmissionOptions({
        user: student,
        researchId: projectId,
        taskId: storedTask.id,
      });
      expect(storedOptions.options).toContainEqual(
        expect.objectContaining({
          kind: "STORED_VERSION",
          document: expect.objectContaining({ id: storedDocument.id }),
          version: expect.objectContaining({
            id: workingVersion.id,
            versionNumber: 1,
            fileName: "stored-working-manuscript.pdf",
            mimeType: "application/pdf",
          }),
        }),
      );
      expect(
        storedOptions.options.some(
          (option) =>
            option.kind === "STORED_VERSION" &&
            option.version.id === mismatchedVersion.id,
        ),
      ).toBe(false);
      expect(storedOptions.unavailableOptionReasons).toContainEqual(
        expect.objectContaining({ code: "DOCUMENT_MILESTONE_MISMATCH" }),
      );
      const storedSubmission = await submitStoredTaskVersion({
        user: student,
        researchId: projectId,
        taskId: storedTask.id,
        documentId: storedDocument.id,
        documentVersionId: workingVersion.id,
      });
      expect(storedSubmission.duplicate).toBe(false);
      expect(storedSubmission.snapshotVersionId).not.toBe(workingVersion.id);
      const [preservedWorkingVersion, storedSnapshot] = await Promise.all([
        prisma.documentVersion.findUniqueOrThrow({
          where: { id: workingVersion.id },
        }),
        prisma.documentVersion.findUniqueOrThrow({
          where: { id: storedSubmission.snapshotVersionId },
        }),
      ]);
      expect(preservedWorkingVersion.isImmutable).toBe(false);
      expect(storedSnapshot.isImmutable).toBe(true);
      expect(storedSnapshot.contentChecksum).toBe(
        crypto.createHash("sha256").update(sourcePdf).digest("hex"),
      );
      expect(storedSnapshot.submissionKey).toHaveLength(64);

      const storedReplay = await submitStoredTaskVersion({
        user: student,
        researchId: projectId,
        taskId: storedTask.id,
        documentId: storedDocument.id,
        documentVersionId: workingVersion.id,
      });
      expect(storedReplay.duplicate).toBe(true);
      expect(storedReplay.snapshotVersionId).toBe(
        storedSubmission.snapshotVersionId,
      );
      await prisma.taskSubmission.update({
        where: {
          researchId_taskId: { researchId: projectId, taskId: storedTask.id },
        },
        data: { status: "APPROVED" },
      });
      const approvedOptions = await getTaskSubmissionOptions({
        user: student,
        researchId: projectId,
        taskId: storedTask.id,
      });
      expect(approvedOptions.availability).toMatchObject({
        canSubmit: false,
        currentStatus: "APPROVED",
      });
      expect(approvedOptions.options).toEqual([]);

      const docxTask = await prisma.workflowTask.create({
        data: {
          stageId: milestoneId,
          title: "DOCX compatibility check",
          sequence: 5,
          allowedFileTypes: "DOCX",
        },
      });
      const docxDocument = await prisma.document.create({
        data: {
          researchId: projectId,
          milestoneId,
          documentType: "MANUSCRIPT",
          title: "DOCX working manuscript",
          currentVersion: 1,
          createdBy: student.id,
        },
      });
      const docxVersion = await prisma.documentVersion.create({
        data: {
          documentId: docxDocument.id,
          milestoneId,
          versionNumber: 1,
          fileName: "working-manuscript.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileSize: 4n,
          storagePath: `/api/documents/files/p3-${fixtureSuffix}-docx`,
          googleDriveFileId: `p3-${fixtureSuffix}-docx`,
          uploadedBy: student.id,
        },
      });
      const docxOptions = await getTaskSubmissionOptions({
        user: student,
        researchId: projectId,
        taskId: docxTask.id,
      });
      expect(docxOptions.options).toContainEqual(
        expect.objectContaining({
          kind: "STORED_VERSION",
          document: expect.objectContaining({ id: docxDocument.id }),
          version: expect.objectContaining({ id: docxVersion.id }),
        }),
      );

      const emptyTask = await prisma.workflowTask.create({
        data: {
          stageId: milestoneId,
          title: "Empty eligibility check",
          sequence: 6,
          allowedFileTypes: "DOC",
        },
      });
      const emptyOptions = await getTaskSubmissionOptions({
        user: student,
        researchId: projectId,
        taskId: emptyTask.id,
      });
      expect(emptyOptions.options).toEqual([]);
      expect(emptyOptions.unavailableOptionReasons).toContainEqual(
        expect.objectContaining({ code: "FILE_TYPE_NOT_ALLOWED" }),
      );

      const concurrentTask = await prisma.workflowTask.create({
        data: {
          stageId: milestoneId,
          title: "Concurrent upload check",
          sequence: 4,
          allowedFileTypes: "PDF",
        },
      });
      const concurrentRequest = () =>
        uploadTaskSubmission({
          user: student,
          researchId: projectId,
          taskId: concurrentTask.id,
          clientKey: "phase1-concurrent-upload-key-01",
          title: "Concurrent manuscript",
          file: {
            buffer: sourcePdf,
            originalname: "concurrent-manuscript.pdf",
            mimetype: "application/pdf",
          },
        });
      const concurrentResults = await Promise.all([
        concurrentRequest(),
        concurrentRequest(),
      ]);
      expect(
        concurrentResults.filter(({ duplicate }) => !duplicate),
      ).toHaveLength(1);
      expect(
        concurrentResults.filter(({ duplicate }) => duplicate),
      ).toHaveLength(1);
      expect(concurrentResults[0].version.id).toBe(
        concurrentResults[1].version.id,
      );
      expect(
        await prisma.taskSubmissionAttempt.count({
          where: { researchId: projectId, taskId: concurrentTask.id },
        }),
      ).toBe(1);
    });
  },
);
