import {
  ManuscriptLifecycleStatus,
  TaskSubmissionStatus,
} from "../lib/prisma.js";
import { describe, expect, it, vi } from "vitest";
import {
  SubmissionIntegrityError,
  assertTaskSubmissionLifecycle,
  authorizeTaskSubmission,
  liveGoogleDocumentEligibility,
  parseAllowedFileTypes,
  storedVersionEligibility,
  storedVersionSubmissionKey,
  taskSubmissionAvailability,
  validateSubmissionArtifact,
} from "./submission.service.js";

describe("submission integrity policy", () => {
  it("requires the student role before project-scoped task authorization", async () => {
    await expect(
      authorizeTaskSubmission({
        user: {
          id: "adviser-a",
          email: "adviser@example.edu",
          universityId: "ADV-1",
          roles: ["ADVISER"],
          permissions: [],
        },
        researchId: "research-a",
        taskId: "task-a",
      }),
    ).rejects.toMatchObject<Partial<SubmissionIntegrityError>>({
      statusCode: 403,
      code: "SUBMISSION_ROLE_REQUIRED",
    });
  });

  it("normalizes professor-configured file requirements", () => {
    expect(
      Array.from(parseAllowedFileTypes(".pdf | DOCX, application/msword")),
    ).toEqual(["PDF", "DOCX", "DOC"]);
    expect(Array.from(parseAllowedFileTypes(null))).toEqual(["PDF", "DOCX"]);
  });

  it("uses a stable, project-and-task-scoped key for stored snapshots", () => {
    const input = {
      researchId: "research-a",
      taskId: "task-a",
      sourceVersionId: "version-a",
    };
    const key = storedVersionSubmissionKey(input);
    expect(key).toHaveLength(64);
    expect(storedVersionSubmissionKey(input)).toBe(key);
    expect(storedVersionSubmissionKey({ ...input, taskId: "task-b" })).not.toBe(
      key,
    );
  });

  it("rejects a Google Docs PDF snapshot for a DOCX-only task", () => {
    expect(() =>
      validateSubmissionArtifact({
        allowedFileTypes: "DOCX",
        fileName: "immutable-manuscript-snapshot.pdf",
        mimeType: "application/pdf",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SubmissionIntegrityError>>({
        statusCode: 415,
        code: "FILE_TYPE_NOT_ALLOWED",
      }),
    );
  });

  it("returns typed Google Docs PDF eligibility without claiming export success", () => {
    const eligible = liveGoogleDocumentEligibility({
      allowedFileTypes: "PDF,DOCX",
      taskMilestoneId: "milestone-a",
      documentMilestoneId: "milestone-a",
      documentLifecycleStatus: ManuscriptLifecycleStatus.DRAFT,
      liveDocumentUrl: "https://docs.google.com/document/d/document-a/edit",
      liveExternalFileId: "document-a",
    });
    expect(eligible).toEqual([]);

    const docxOnly = liveGoogleDocumentEligibility({
      allowedFileTypes: "DOCX",
      taskMilestoneId: "milestone-a",
      documentMilestoneId: "milestone-a",
      documentLifecycleStatus: ManuscriptLifecycleStatus.DRAFT,
      liveDocumentUrl: "https://docs.google.com/document/d/document-a/edit",
      liveExternalFileId: "document-a",
    });
    expect(docxOnly).toContainEqual(
      expect.objectContaining({
        code: "FILE_TYPE_NOT_ALLOWED",
        statusCode: 415,
      }),
    );
  });

  it("filters stored versions by exact format, milestone, mutability, and lifecycle", () => {
    const base = {
      taskMilestoneId: "milestone-a",
      documentLifecycleStatus: ManuscriptLifecycleStatus.DRAFT,
      version: {
        status: "ACTIVE",
        isImmutable: false,
        milestoneId: "milestone-a",
        fileName: "working-manuscript.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    };
    expect(
      storedVersionEligibility({ ...base, allowedFileTypes: "PDF,DOCX" }),
    ).toEqual([]);
    expect(
      storedVersionEligibility({ ...base, allowedFileTypes: "PDF" }),
    ).toContainEqual(
      expect.objectContaining({ code: "FILE_TYPE_NOT_ALLOWED" }),
    );
    expect(
      storedVersionEligibility({
        ...base,
        allowedFileTypes: "DOCX",
        version: { ...base.version, milestoneId: "milestone-b" },
      }),
    ).toContainEqual(
      expect.objectContaining({ code: "DOCUMENT_MILESTONE_MISMATCH" }),
    );
    expect(
      storedVersionEligibility({
        ...base,
        allowedFileTypes: "DOCX",
        version: { ...base.version, isImmutable: true },
      }),
    ).toContainEqual(
      expect.objectContaining({ code: "IMMUTABLE_SOURCE_VERSION" }),
    );
    expect(
      storedVersionEligibility({
        ...base,
        allowedFileTypes: "DOCX",
        documentLifecycleStatus: ManuscriptLifecycleStatus.APPROVED,
      }),
    ).toContainEqual(
      expect.objectContaining({ code: "INVALID_DOCUMENT_LIFECYCLE" }),
    );
  });

  it("reports initial, revision, under-review, and approved task availability", () => {
    expect(taskSubmissionAvailability(null)).toMatchObject({
      canSubmit: true,
      mode: "INITIAL",
    });
    expect(
      taskSubmissionAvailability(TaskSubmissionStatus.REVISION_REQUIRED),
    ).toMatchObject({ canSubmit: true, mode: "REVISION" });
    expect(
      taskSubmissionAvailability(TaskSubmissionStatus.UNDER_REVIEW),
    ).toMatchObject({
      canSubmit: false,
      currentStatus: TaskSubmissionStatus.UNDER_REVIEW,
      reasons: [
        expect.objectContaining({ code: "INVALID_SUBMISSION_LIFECYCLE" }),
      ],
    });
    expect(
      taskSubmissionAvailability(TaskSubmissionStatus.APPROVED),
    ).toMatchObject({
      canSubmit: false,
      currentStatus: TaskSubmissionStatus.APPROVED,
    });
  });

  it("validates extension, MIME type, and binary signatures", () => {
    expect(
      validateSubmissionArtifact({
        allowedFileTypes: "PDF,DOCX",
        fileName: "manuscript.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\n"),
      }),
    ).toBe("PDF");

    expect(() =>
      validateSubmissionArtifact({
        allowedFileTypes: "PDF,DOCX",
        fileName: "renamed.pdf",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: Buffer.from("PK\u0003\u0004"),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SubmissionIntegrityError>>({
        code: "FILE_TYPE_MISMATCH",
      }),
    );

    expect(() =>
      validateSubmissionArtifact({
        allowedFileTypes: "PDF",
        fileName: "fake.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("not a pdf"),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SubmissionIntegrityError>>({
        code: "INVALID_FILE_CONTENT",
      }),
    );
  });

  it("allows only an initial attempt or a revision-required resubmission", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "summary-a",
        status: TaskSubmissionStatus.REVISION_REQUIRED,
      })
      .mockResolvedValueOnce({
        id: "summary-a",
        status: TaskSubmissionStatus.UNDER_REVIEW,
      });
    const tx = { taskSubmission: { findUnique } } as any;
    await expect(
      assertTaskSubmissionLifecycle(tx, {
        researchId: "research-a",
        taskId: "task-a",
      }),
    ).resolves.toMatchObject({ existing: null });
    await expect(
      assertTaskSubmissionLifecycle(tx, {
        researchId: "research-a",
        taskId: "task-a",
      }),
    ).resolves.toMatchObject({
      existing: { status: TaskSubmissionStatus.REVISION_REQUIRED },
    });
    await expect(
      assertTaskSubmissionLifecycle(tx, {
        researchId: "research-a",
        taskId: "task-a",
      }),
    ).rejects.toMatchObject<Partial<SubmissionIntegrityError>>({
      statusCode: 409,
      code: "INVALID_SUBMISSION_LIFECYCLE",
    });
  });

  it("returns an authorized exact-version replay before rejecting lifecycle state", async () => {
    const duplicateAttempt = {
      id: "attempt-a",
      documentVersionId: "version-a",
    };
    const tx = {
      taskSubmission: {
        findUnique: vi.fn().mockResolvedValue({
          id: "summary-a",
          status: TaskSubmissionStatus.APPROVED,
          attempts: [duplicateAttempt],
        }),
      },
    } as any;
    await expect(
      assertTaskSubmissionLifecycle(tx, {
        researchId: "research-a",
        taskId: "task-a",
        replayVersionId: "version-a",
      }),
    ).resolves.toMatchObject({ duplicateAttempt });
  });
});
