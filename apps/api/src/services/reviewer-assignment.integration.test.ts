import crypto from "node:crypto";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { ManuscriptLifecycleStatus, prisma } from "../lib/prisma.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { documentAccessService } from "./document-access.service.js";
import { googleDriveService } from "./google-drive.service.js";
import { manuscriptLifecycleService } from "./manuscript-lifecycle.service.js";
import {
  ReviewerAssignmentError,
  reviewerAssignmentService,
} from "./reviewer-assignment.service.js";
import {
  advanceMilestoneIfSatisfied,
  getManuscriptActivity,
  getMilestoneProgress,
  recordTaskSubmissionAttempt,
} from "./research-workflow-integration.service.js";
import { storageHierarchyService } from "./storage-hierarchy.service.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

function auth(
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

databaseDescribe("Phase 4 formal manuscript review workflow", () => {
  const fixtureSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  const fixture = createIntegrationFixtureScope(
    `phase4-${fixtureSuffix.toLowerCase()}`,
  );
  let student: AuthenticatedUser;
  let adviser: AuthenticatedUser;
  let professor: AuthenticatedUser;
  let panelist: AuthenticatedUser;
  let replacementPanelist: AuthenticatedUser;
  let outsider: AuthenticatedUser;
  let administrator: AuthenticatedUser;
  let projectId: string;
  let documentId: string;
  let milestoneId: string;
  let taskId: string;
  let supportingTaskId: string;
  const v1Pdf = Buffer.from(
    "%PDF-1.4\nPhase 4 manuscript version one\n%%EOF\n",
  );
  const v2Pdf = Buffer.from("%PDF-1.4\nPhase 4 revised version two\n%%EOF\n");

  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    const college = await prisma.college.create({
      data: { code: `P4${fixtureSuffix}`, name: "Phase 4 Isolated College" },
    });
    fixture.collegeIds.push(college.id);
    const program = await prisma.program.create({
      data: {
        collegeId: college.id,
        code: `P4IT${fixtureSuffix}`,
        name: "Phase 4 Isolated Program",
      },
    });
    fixture.programIds.push(program.id);
    const academicYear = await prisma.academicYear.create({
      data: {
        name: `P4-${fixtureSuffix}`,
        startDate: new Date("2097-06-01T00:00:00.000Z"),
        endDate: new Date("2098-05-31T00:00:00.000Z"),
      },
    });
    fixture.academicYearIds.push(academicYear.id);
    const roleNames = [
      "RESEARCHER",
      "ADVISER",
      "RESEARCH_COORDINATOR",
      "PANELIST",
      "SYSTEM_ADMIN",
    ] as const;
    await prisma.role.createMany({
      data: roleNames.map((name) => ({ name })),
      skipDuplicates: true,
    });
    const storedRoles = await prisma.role.findMany({
      where: { name: { in: [...roleNames] } },
    });
    const roles = new Map(storedRoles.map((role) => [role.name, role]));
    const createUser = async (
      suffix: string,
      role: (typeof roleNames)[number],
    ) => {
      const user = await prisma.user.create({
        data: {
          universityId: `P4-${fixtureSuffix}-${suffix}`,
          email: `phase4-${fixtureSuffix.toLowerCase()}-${suffix.toLowerCase()}@isolated.test`,
          firstName: suffix,
          lastName: "Fixture",
          status: "ACTIVE",
          collegeId: college.id,
          programId: program.id,
        },
      });
      fixture.userIds.push(user.id);
      await prisma.userRole.create({
        data: { userId: user.id, roleId: roles.get(role)!.id },
      });
      return {
        record: user,
        authenticated: auth(user, [role], college.id, program.id),
      };
    };
    const users = await Promise.all([
      createUser("Student", "RESEARCHER"),
      createUser("Adviser", "ADVISER"),
      createUser("Professor", "RESEARCH_COORDINATOR"),
      createUser("Panelist", "PANELIST"),
      createUser("ReplacementPanelist", "PANELIST"),
      createUser("Outsider", "RESEARCHER"),
      createUser("Administrator", "SYSTEM_ADMIN"),
    ]);
    [
      student,
      adviser,
      professor,
      panelist,
      replacementPanelist,
      outsider,
      administrator,
    ] = users.map(({ authenticated }) => authenticated);

    const researchType = await prisma.researchType.create({
      data: {
        programId: program.id,
        name: "Phase 4 Manuscript",
        code: `P4-MANUSCRIPT-${fixtureSuffix}`,
      },
    });
    fixture.researchTypeIds.push(researchType.id);
    const workflow = await prisma.workflow.create({
      data: {
        researchTypeId: researchType.id,
        name: "Phase 4 Verification Workflow",
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
        name: "Formal Manuscript Review",
        sequence: 1,
        responsibleRoleId: roles.get("RESEARCH_COORDINATOR")!.id,
        requiresApproval: true,
      },
    });
    milestoneId = milestone.id;
    const task = await prisma.workflowTask.create({
      data: { stageId: milestone.id, title: "Submit manuscript", sequence: 1 },
    });
    taskId = task.id;
    const supportingTask = await prisma.workflowTask.create({
      data: {
        stageId: milestone.id,
        title: "Submit supporting requirement",
        sequence: 2,
        isRequired: true,
      },
    });
    supportingTaskId = supportingTask.id;
    const project = await prisma.researchProject.create({
      data: {
        researchTypeId: researchType.id,
        programId: program.id,
        collegeId: college.id,
        academicYearId: academicYear.id,
        title: "Phase 4 isolated review verification",
        groupName: "Phase 4 Group",
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
        { researchId: project.id, userId: adviser.id, projectRole: "ADVISER" },
        {
          researchId: project.id,
          userId: panelist.id,
          projectRole: "PANELIST",
        },
      ],
    });
    const document = await prisma.document.create({
      data: {
        researchId: project.id,
        milestoneId: milestone.id,
        documentType: "MANUSCRIPT",
        title: "Phase 4 Research Manuscript",
        currentVersion: 0,
        liveDocumentUrl:
          "https://docs.google.com/document/d/phase4-source/edit",
        liveExternalFileId: `phase4-source-${fixtureSuffix}`,
        createdBy: student.id,
      },
    });
    documentId = document.id;

    vi.spyOn(storageHierarchyService, "resolveFolder").mockResolvedValue(
      "phase4-submissions-folder",
    );
    vi.spyOn(googleDriveService, "exportImmutablePdf")
      .mockResolvedValueOnce({
        buffer: v1Pdf,
        fileName: "Phase 4 Research Manuscript.pdf",
        mimeType: "application/pdf",
        sourceMimeType: "application/vnd.google-apps.document",
        sourceModifiedAt: new Date("2026-10-13T09:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        buffer: v2Pdf,
        fileName: "Phase 4 Research Manuscript.pdf",
        mimeType: "application/pdf",
        sourceMimeType: "application/vnd.google-apps.document",
        sourceModifiedAt: new Date("2026-10-13T10:00:00.000Z"),
      });
    let uploadNumber = 0;
    vi.spyOn(googleDriveService, "uploadFile").mockImplementation(
      async (options) => {
        uploadNumber += 1;
        return {
          fileId: `phase4-${fixtureSuffix}-snapshot-${uploadNumber}`,
          fileName: options.fileName,
          mimeType: options.mimeType,
          sizeBytes: options.buffer.length,
          webViewLink: `/api/documents/files/phase4-${fixtureSuffix}-snapshot-${uploadNumber}`,
          webContentLink: `/api/documents/files/phase4-${fixtureSuffix}-snapshot-${uploadNumber}?download=1`,
          storagePath: `google-drive://phase4-${fixtureSuffix}-snapshot-${uploadNumber}`,
        };
      },
    );
    vi.spyOn(googleDriveService, "deleteStoredFile").mockResolvedValue(true);
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

  it("tracks revision rounds and approves only after all mandatory exact-version decisions", async () => {
    const first = await manuscriptLifecycleService.submit({
      documentId,
      milestoneId,
      taskId,
      idempotencyKey: "phase4-submission-version-0001",
      user: student,
    });
    expect(first.lifecycleStatus).toBe("IN_REVIEW");
    const firstAttempt = await prisma.taskSubmissionAttempt.findFirstOrThrow({
      where: { documentVersionId: first.version.id },
    });
    expect(firstAttempt).toMatchObject({
      attemptNumber: 1,
      status: "UNDER_REVIEW",
      researchId: projectId,
      taskId,
      milestoneId,
      documentId,
    });
    const v1Assignments = await prisma.reviewerAssignment.findMany({
      where: { documentVersionId: first.version.id },
      orderBy: { reviewType: "asc" },
    });
    expect(v1Assignments).toHaveLength(2);
    expect(v1Assignments.every((assignment) => assignment.isRequired)).toBe(
      true,
    );
    expect(v1Assignments.map(({ reviewType }) => reviewType).sort()).toEqual([
      "ADVISER",
      "COORDINATOR",
    ]);
    expect(
      await prisma.notification.count({
        where: {
          type: "REVIEW_ASSIGNED",
          entityId: { in: v1Assignments.map(({ id }) => id) },
        },
      }),
    ).toBe(2);
    expect(
      await documentAccessService.canViewVersion(outsider, first.version.id),
    ).toBe(false);
    expect(
      await documentAccessService.canViewVersion(adviser, first.version.id),
    ).toBe(true);

    const adviserV1 = v1Assignments.find(
      (assignment) => assignment.reviewerId === adviser.id,
    )!;
    await expect(
      reviewerAssignmentService.decide({
        assignmentId: adviserV1.id,
        recommendation: "APPROVE",
        user: outsider,
      }),
    ).rejects.toMatchObject<Partial<ReviewerAssignmentError>>({
      statusCode: 403,
      code: "ASSIGNED_REVIEWER_REQUIRED",
    });
    const revision = await reviewerAssignmentService.decide({
      assignmentId: adviserV1.id,
      recommendation: "MAJOR_REVISION",
      overallComment: "Revise the methodology and sampling discussion.",
      comments: [{ comment: "Clarify the participant selection criteria." }],
      user: adviser,
    });
    expect(revision.lifecycleStatus).toBe("REVISION_REQUIRED");
    expect(
      await prisma.notification.count({
        where: {
          recipientId: student.id,
          type: "REVISION_REQUESTED",
          entityId: first.version.id,
        },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.taskSubmissionAttempt.findUniqueOrThrow({
          where: { id: firstAttempt.id },
        })
      ).status,
    ).toBe("REVISION_REQUIRED");
    const v1AfterRevision = await prisma.documentVersion.findUniqueOrThrow({
      where: { id: first.version.id },
      include: {
        reviewerAssignments: true,
        reviews: { include: { comments: true } },
      },
    });
    expect(v1AfterRevision.reviewerAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "COMPLETED" }),
        expect.objectContaining({ status: "SUPERSEDED" }),
      ]),
    );
    expect(v1AfterRevision.reviews[0].comments).toHaveLength(1);
    await expect(
      prisma.review.update({
        where: { id: v1AfterRevision.reviews[0].id },
        data: { recommendation: "APPROVE" },
      }),
    ).rejects.toThrow(
      /submitted manuscript review decisions cannot be changed/i,
    );

    const studentWorkflow = await reviewerAssignmentService.reviewWorkflow(
      student,
      documentId,
    );
    expect(studentWorkflow.versions[0].reviews[0].overallComment).toContain(
      "methodology",
    );
    expect(studentWorkflow.versions[0].reviews[0].reviewer).toBeNull();

    const second = await manuscriptLifecycleService.submit({
      documentId,
      milestoneId,
      taskId,
      idempotencyKey: "phase4-submission-version-0002",
      note: "Methodology revised in the live Google working document.",
      user: student,
    });
    expect(second.version.versionNumber).toBe(2);
    expect(second.lifecycleStatus).toBe("IN_REVIEW");
    const attemptsAfterRevision = await prisma.taskSubmissionAttempt.findMany({
      where: { researchId: projectId, taskId },
      orderBy: { attemptNumber: "asc" },
    });
    expect(attemptsAfterRevision).toHaveLength(2);
    expect(
      attemptsAfterRevision.map(({ attemptNumber }) => attemptNumber),
    ).toEqual([1, 2]);
    expect(attemptsAfterRevision[0].documentVersionId).toBe(first.version.id);
    expect(attemptsAfterRevision[1].documentVersionId).toBe(second.version.id);
    expect(second.version.contentChecksum).toBe(
      crypto.createHash("sha256").update(v2Pdf).digest("hex"),
    );
    const preservedV1 = await prisma.documentVersion.findUniqueOrThrow({
      where: { id: first.version.id },
    });
    expect(preservedV1.contentChecksum).toBe(
      crypto.createHash("sha256").update(v1Pdf).digest("hex"),
    );
    expect(preservedV1.status).toBe("SUPERSEDED");

    await expect(
      reviewerAssignmentService.assign({
        versionId: second.version.id,
        reviewerId: adviser.id,
        reviewType: "ADVISER",
        isRequired: true,
        user: professor,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_ASSIGNMENT" });
    await expect(
      reviewerAssignmentService.assign({
        versionId: second.version.id,
        reviewerId: panelist.id,
        reviewType: "PANEL",
        isRequired: false,
        user: administrator,
      }),
    ).rejects.toMatchObject({ code: "ASSIGNMENT_AUTHORITY_REQUIRED" });
    const optionalPanel = await reviewerAssignmentService.assign({
      versionId: second.version.id,
      reviewerId: panelist.id,
      reviewType: "PANEL",
      isRequired: false,
      user: professor,
    });
    await expect(
      reviewerAssignmentService.reassign({
        assignmentId: optionalPanel.id,
        reviewerId: replacementPanelist.id,
        reason: "Original panelist is unavailable.",
        user: professor,
      }),
    ).rejects.toMatchObject({ code: "REVIEWER_SCOPE_REQUIRED" });
    await prisma.researchMember.create({
      data: {
        researchId: projectId,
        userId: replacementPanelist.id,
        projectRole: "PANELIST",
      },
    });
    const replacement = await reviewerAssignmentService.reassign({
      assignmentId: optionalPanel.id,
      reviewerId: replacementPanelist.id,
      reason: "Original panelist is unavailable.",
      user: professor,
    });
    await reviewerAssignmentService.revoke({
      assignmentId: replacement.id,
      reason: "Optional panel review is no longer needed.",
      user: professor,
    });
    await expect(
      reviewerAssignmentService.revoke({
        assignmentId: replacement.id,
        reason: "Repeated request.",
        user: professor,
      }),
    ).rejects.toMatchObject({ code: "ASSIGNMENT_NOT_ACTIVE" });
    const nonBlockingOptional = await reviewerAssignmentService.assign({
      versionId: second.version.id,
      reviewerId: panelist.id,
      reviewType: "PANEL",
      isRequired: false,
      user: professor,
    });

    const v2Assignments = await prisma.reviewerAssignment.findMany({
      where: {
        documentVersionId: second.version.id,
        isRequired: true,
        status: "ACTIVE",
      },
    });
    const adviserV2 = v2Assignments.find(
      (assignment) => assignment.reviewerId === adviser.id,
    )!;
    const professorV2 = v2Assignments.find(
      (assignment) => assignment.reviewerId === professor.id,
    )!;
    const adviserApproval = await reviewerAssignmentService.decide({
      assignmentId: adviserV2.id,
      recommendation: "APPROVE",
      overallComment: "The requested revisions are complete.",
      user: adviser,
    });
    expect(adviserApproval.lifecycleStatus).toBe("IN_REVIEW");
    expect(
      await prisma.notification.count({
        where: {
          recipientId: professor.id,
          type: "DOCUMENT_REVIEWED",
          entityId: second.version.id,
        },
      }),
    ).toBe(1);
    expect((await getMilestoneProgress(prisma, projectId))[0]).toMatchObject({
      id: milestoneId,
      completed: false,
      status: "AWAITING_REVIEW",
    });

    const session = await prisma.defenseSession.create({
      data: { researchId: projectId, createdBy: professor.id },
    });
    const packet = await prisma.defensePacket.create({
      data: {
        defenseSessionId: session.id,
        manuscriptVersionId: first.version.id,
        publishedById: professor.id,
      },
    });
    const concurrent = await Promise.allSettled([
      reviewerAssignmentService.decide({
        assignmentId: professorV2.id,
        recommendation: "APPROVE",
        overallComment: "Approved for the next research milestone.",
        user: professor,
      }),
      reviewerAssignmentService.decide({
        assignmentId: professorV2.id,
        recommendation: "APPROVE",
        overallComment: "Duplicate concurrent approval request.",
        user: professor,
      }),
    ]);
    expect(
      concurrent.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      concurrent.filter(({ status }) => status === "rejected"),
    ).toHaveLength(1);

    const approved = await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
    });
    expect(approved.lifecycleStatus).toBe("APPROVED");
    expect(approved.currentVersion).toBe(2);
    expect((await getMilestoneProgress(prisma, projectId))[0]).toMatchObject({
      id: milestoneId,
      completed: false,
      status: "APPROVED",
    });
    const finalAttempts = await prisma.taskSubmissionAttempt.findMany({
      where: { researchId: projectId, taskId },
      orderBy: { attemptNumber: "asc" },
    });
    expect(finalAttempts[0]).toMatchObject({
      documentVersionId: first.version.id,
      status: "REVISION_REQUIRED",
    });
    expect(finalAttempts[1]).toMatchObject({
      documentVersionId: second.version.id,
      status: "APPROVED",
    });
    const supportingDocument = await prisma.document.create({
      data: {
        researchId: projectId,
        milestoneId,
        documentType: "SUPPORTING_REQUIREMENT",
        title: "Phase 5 supporting requirement",
        currentVersion: 1,
        createdBy: student.id,
      },
    });
    const supportingVersion = await prisma.documentVersion.create({
      data: {
        documentId: supportingDocument.id,
        versionNumber: 1,
        fileName: "supporting-requirement.pdf",
        mimeType: "application/pdf",
        fileSize: 32,
        storagePath: `test://phase5/${fixtureSuffix}/supporting-requirement.pdf`,
        uploadedBy: student.id,
        manuscriptStatus: "APPROVED",
        isImmutable: true,
        contentChecksum: "a".repeat(64),
        submissionKey: `phase5-supporting-${fixtureSuffix}`,
        submittedBy: student.id,
        submittedAt: new Date(),
        snapshotCreatedAt: new Date(),
        milestoneId,
      },
    });
    const completedProgression = await prisma.$transaction(async (tx) => {
      await recordTaskSubmissionAttempt(tx, {
        researchId: projectId,
        taskId: supportingTaskId,
        milestoneId,
        documentId: supportingDocument.id,
        documentVersionId: supportingVersion.id,
        submittedBy: student.id,
        submittedAt: new Date(),
        lifecycleStatus: ManuscriptLifecycleStatus.APPROVED,
      });
      return advanceMilestoneIfSatisfied(tx, {
        researchId: projectId,
        milestoneId,
        actorId: professor.id,
      });
    });
    expect(completedProgression).toMatchObject({
      advanced: true,
      completed: true,
    });
    expect(
      await prisma.notification.count({
        where: {
          recipientId: student.id,
          type: "WORKFLOW_CHANGED",
          entityId: milestoneId,
        },
      }),
    ).toBe(1);
    expect((await getMilestoneProgress(prisma, projectId))[0]).toMatchObject({
      id: milestoneId,
      completed: true,
      status: "COMPLETED",
      completionPercent: 100,
    });
    const studentActivity = await getManuscriptActivity(
      prisma,
      projectId,
      false,
    );
    expect(studentActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "TASK_SUBMISSION" }),
        expect.objectContaining({ type: "REVISION_REQUIRED" }),
        expect.objectContaining({ type: "REVIEW_DECISION" }),
      ]),
    );
    expect(
      studentActivity.find(({ type }) => type === "REVIEW_DECISION")?.actor,
    ).toEqual({
      id: null,
      name: "Assigned faculty",
    });
    expect(
      (
        await prisma.reviewerAssignment.findUniqueOrThrow({
          where: { id: nonBlockingOptional.id },
        })
      ).status,
    ).toBe("SUPERSEDED");
    const approvedPacket = await prisma.defensePacket.findUniqueOrThrow({
      where: { id: packet.id },
    });
    expect(approvedPacket.manuscriptVersionId).toBe(second.version.id);
    expect(
      await prisma.notification.count({
        where: { recipientId: student.id, type: "MANUSCRIPT_APPROVED" },
      }),
    ).toBe(1);
    expect(
      await prisma.reviewerAssignmentEvent.count({
        where: { assignment: { documentVersionId: second.version.id } },
      }),
    ).toBeGreaterThanOrEqual(7);
  });
});
