import { describe, expect, it } from "vitest";
import { taskUploadOperationKey } from "./task-submission-upload.service.js";

describe("taskUploadOperationKey", () => {
  it("returns the same key for a retried client operation", () => {
    const input = { researchId: "research-a", taskId: "task-a", userId: "user-a", clientKey: "request-a" };
    expect(taskUploadOperationKey(input)).toBe(taskUploadOperationKey(input));
  });

  it("does not collapse operations from different projects, tasks, or users", () => {
    const base = { researchId: "research-a", taskId: "task-a", userId: "user-a", clientKey: "request-a" };
    const key = taskUploadOperationKey(base);
    expect(taskUploadOperationKey({ ...base, researchId: "research-b" })).not.toBe(key);
    expect(taskUploadOperationKey({ ...base, taskId: "task-b" })).not.toBe(key);
    expect(taskUploadOperationKey({ ...base, userId: "user-b" })).not.toBe(key);
  });
});
