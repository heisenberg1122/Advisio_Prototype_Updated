import { describe, expect, it } from "vitest";
import {
  addCohortMembersSchema,
  assignCohortWorkflowSchema,
  cohortListQuerySchema,
  cohortMemberParamsSchema,
  cohortParamsSchema,
  createCohortSchema,
  eligibleCohortResearchersQuerySchema,
  updateCohortSchema,
} from "./cohorts.js";

const id = "11111111-1111-4111-8111-111111111111";
const input = {
  name: "  BSIT Cohort A  ",
  collegeId: id,
  programId: id,
  researchTypeId: id,
  academicYearId: id,
};

describe("cohort request contracts", () => {
  it("bounds eligible researcher search and rejects academic scope overrides", () => {
    expect(eligibleCohortResearchersQuerySchema.parse({})).toEqual({
      search: "",
      page: 1,
      limit: 20,
    });
    expect(
      eligibleCohortResearchersQuerySchema.parse({
        search: "  Nicole  ",
        page: "2",
        limit: "10",
      }),
    ).toEqual({ search: "Nicole", page: 2, limit: 10 });
    for (const input of [
      { collegeId: id },
      { programId: id },
      { researchTypeId: id },
      { limit: 51 },
      { page: 0 },
      { search: "x".repeat(101) },
    ])
      expect(
        eligibleCohortResearchersQuerySchema.safeParse(input).success,
      ).toBe(false);
  });
  it("normalizes names and leaves creation status and ownership server-controlled", () => {
    expect(createCohortSchema.parse(input).name).toBe("BSIT Cohort A");
    for (const extra of [
      { createdBy: id },
      { status: "ACTIVE" },
      { workflowId: id },
    ])
      expect(createCohortSchema.safeParse({ ...input, ...extra }).success).toBe(
        false,
      );
  });
  it.each(["collegeId", "programId", "researchTypeId", "academicYearId"])(
    "requires a valid %s",
    (key) => {
      expect(
        createCohortSchema.safeParse({ ...input, [key]: "invalid" }).success,
      ).toBe(false);
      expect(
        createCohortSchema.safeParse({ ...input, [key]: undefined }).success,
      ).toBe(false);
    },
  );
  it("bounds names and descriptions", () => {
    expect(createCohortSchema.safeParse({ ...input, name: " " }).success).toBe(
      false,
    );
    expect(
      createCohortSchema.safeParse({ ...input, name: "x".repeat(151) }).success,
    ).toBe(false);
    expect(
      createCohortSchema.safeParse({ ...input, description: "x".repeat(5001) })
        .success,
    ).toBe(false);
  });
  it("accepts lifecycle updates and clearing a description", () => {
    for (const status of ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"])
      expect(updateCohortSchema.parse({ status })).toEqual({ status });
    expect(updateCohortSchema.parse({ description: null })).toEqual({
      description: null,
    });
  });
  it("rejects empty updates and attempts to change academic identity or process", () => {
    for (const value of [
      {},
      { name: undefined },
      { status: "DELETED" },
      { collegeId: id },
      { programId: id },
      { academicYearId: id },
      { researchTypeId: id },
      { workflowId: id },
      { createdBy: id },
    ])
      expect(updateCohortSchema.safeParse(value).success).toBe(false);
  });
  it("accepts only an explicit workflow UUID for assignment", () => {
    expect(assignCohortWorkflowSchema.parse({ workflowId: id })).toEqual({
      workflowId: id,
    });
    for (const value of [
      {},
      { workflowId: null },
      { workflowId: "bad" },
      { workflowId: id, status: "PUBLISHED" },
    ])
      expect(assignCohortWorkflowSchema.safeParse(value).success).toBe(false);
  });
  it("normalizes single and batch member requests and caps batch size", () => {
    expect(addCohortMembersSchema.parse({ userId: id })).toEqual({
      userIds: [id],
    });
    expect(addCohortMembersSchema.parse({ userIds: [id, id] })).toEqual({
      userIds: [id],
    });
    for (const value of [
      { userIds: [] },
      { userIds: ["bad"] },
      { userIds: Array(101).fill(id) },
      { userId: id, userIds: [id] },
      { userId: id, status: "REMOVED" },
    ])
      expect(addCohortMembersSchema.safeParse(value).success).toBe(false);
  });
  it("canonicalizes UUIDs before deduplicating member identities", () => {
    const value = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
    expect(
      addCohortMembersSchema.parse({ userIds: [value, value.toUpperCase()] }),
    ).toEqual({ userIds: [value] });
  });
  it("bounds pagination and rejects arbitrary query or route values", () => {
    expect(cohortListQuerySchema.parse({})).toEqual({ page: 1, limit: 50 });
    expect(cohortListQuerySchema.parse({ page: "2", limit: "10" })).toEqual({
      page: 2,
      limit: 10,
    });
    for (const value of [
      { limit: "101" },
      { page: "0" },
      { page: "1.5" },
      { status: "bad" },
      { createdBy: id },
    ])
      expect(cohortListQuerySchema.safeParse(value).success).toBe(false);
    expect(cohortParamsSchema.safeParse({ id: "bad" }).success).toBe(false);
    expect(
      cohortMemberParamsSchema.safeParse({ id, userId: "bad" }).success,
    ).toBe(false);
  });
});
