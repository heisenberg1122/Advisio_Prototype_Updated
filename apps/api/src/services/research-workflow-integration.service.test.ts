import { describe, expect, it } from "vitest";
import { ManuscriptLifecycleStatus, TaskSubmissionStatus } from "../lib/prisma.js";
import { taskStatusForManuscript } from "./research-workflow-integration.service.js";

describe("research workflow manuscript synchronization", () => {
  it.each([
    [ManuscriptLifecycleStatus.DRAFT, TaskSubmissionStatus.SUBMITTED],
    [ManuscriptLifecycleStatus.SUBMITTED, TaskSubmissionStatus.SUBMITTED],
    [ManuscriptLifecycleStatus.IN_REVIEW, TaskSubmissionStatus.UNDER_REVIEW],
    [
      ManuscriptLifecycleStatus.REVISION_REQUIRED,
      TaskSubmissionStatus.REVISION_REQUIRED,
    ],
    [ManuscriptLifecycleStatus.APPROVED, TaskSubmissionStatus.APPROVED],
    [ManuscriptLifecycleStatus.FINALIZED, TaskSubmissionStatus.APPROVED],
  ])("maps manuscript %s to task %s", (manuscriptStatus, taskStatus) => {
    expect(taskStatusForManuscript(manuscriptStatus)).toBe(taskStatus);
  });
});
