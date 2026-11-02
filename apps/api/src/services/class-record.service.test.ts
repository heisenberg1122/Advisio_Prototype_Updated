import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permissions } from "@research-management/auth";
import type { AuthenticatedUser } from "../middleware/auth.js";
const db = vi.hoisted(() => ({
  workflow: { findUnique: vi.fn() },
  researchType: { findUnique: vi.fn() },
  workflowEnrollment: { findFirst: vi.fn() },
  classRecordRelease: { findMany: vi.fn() },
  classRecordScore: { findMany: vi.fn() },
  classRecordAttendance: { findMany: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({ prisma: db, Prisma: {} }));
vi.mock("./audit.service.js", () => ({ recordAudit: vi.fn() }));
import {
  assertClassRecordAccess,
  getMyClassRecord,
  recordScores,
  recordSettings,
  recordSession,
  recordItem,
} from "./class-record.service.js";
const id = "00000000-0000-4000-8000-000000000001";
const actor = (extra: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: "professor",
  email: "p@local.test",
  universityId: "P1",
  roles: ["RESEARCH_COORDINATOR"],
  permissions: [Permissions.WORKFLOW_EDIT],
  collegeId: "college",
  ...extra,
});
beforeEach(() => {
  vi.resetAllMocks();
  db.workflow.findUnique.mockResolvedValue({
    id: "workflow",
    createdBy: "professor",
    researchTypeId: "type",
    name: "Research 1",
  });
  db.researchType.findUnique.mockResolvedValue({
    program: { collegeId: "college" },
  });
  db.workflowEnrollment.findFirst.mockResolvedValue({ id: "enrollment" });
  db.classRecordRelease.findMany.mockResolvedValue([]);
});
describe("class record authorization and privacy", () => {
  it("restricts editing to the owning professor in the active college", async () => {
    await expect(
      assertClassRecordAccess("workflow", actor(), true),
    ).resolves.toHaveProperty("id", "workflow");
    for (const user of [
      actor({ id: "other-professor" }),
      actor({ collegeId: "other" }),
      actor({ researcherPanel: true }),
      actor({ permissions: [] }),
      actor({ roles: ["ADVISER"] }),
    ])
      await expect(
        assertClassRecordAccess("workflow", user, true),
      ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("requires current enrollment to read a personal record", async () => {
    const user = actor({
      id: "student",
      roles: ["RESEARCHER"],
      permissions: [],
    });
    await expect(
      assertClassRecordAccess("workflow", user, false),
    ).resolves.toHaveProperty("id", "workflow");
    db.workflowEnrollment.findFirst.mockResolvedValue(null);
    await expect(getMyClassRecord("workflow", user)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(db.classRecordRelease.findMany).not.toHaveBeenCalled();
  });
  it("reads only the authenticated student's releases and never draft tables", async () => {
    const user = actor({
      id: "student",
      roles: ["RESEARCHER"],
      permissions: [],
    });
    const data = await getMyClassRecord("workflow", user);
    expect(db.classRecordRelease.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "student", period: { workflowId: "workflow" } },
      }),
    );
    expect(db.classRecordScore.findMany).not.toHaveBeenCalled();
    expect(db.classRecordAttendance.findMany).not.toHaveBeenCalled();
    expect(data.periods.every((p) => p.release === null)).toBe(true);
    expect(data.overall).toBeNull();
  });
  it("calculates overall only from three released snapshots with weights totaling 100", async () => {
    const snapshots = [
      {
        period: { code: "PRELIM" },
        snapshot: { calculation: { score: 80 }, overallWeight: 30 },
      },
      {
        period: { code: "MIDTERM" },
        snapshot: { calculation: { score: 90 }, overallWeight: 30 },
      },
      {
        period: { code: "FINALS" },
        snapshot: { calculation: { score: 95 }, overallWeight: 40 },
      },
    ];
    db.classRecordRelease.findMany.mockResolvedValue(snapshots);
    const user = actor({ roles: ["RESEARCHER"] });
    expect((await getMyClassRecord("workflow", user)).overall).toBe(89);
    db.classRecordRelease.findMany.mockResolvedValue(snapshots.slice(0, 2));
    expect((await getMyClassRecord("workflow", user)).overall).toBeNull();
  });
});
describe("class record input boundaries", () => {
  it("requires category weights to total 100", () => {
    const base = { expectedRevision: 0, lateCredit: 100, overallWeight: null };
    expect(
      recordSettings.safeParse({
        ...base,
        weights: { MILESTONE: 60, INDIVIDUAL: 30, ATTENDANCE: 10 },
      }).success,
    ).toBe(true);
    expect(
      recordSettings.safeParse({
        ...base,
        weights: { MILESTONE: 60, INDIVIDUAL: 60, ATTENDANCE: 0 },
      }).success,
    ).toBe(false);
  });
  it("keeps graded zero distinct from ungraded, missing and excused", () => {
    const entry = { itemId: id, studentId: id, state: "GRADED", score: 0 };
    expect(
      recordScores.safeParse({ expectedRevision: 0, entries: [entry] }).success,
    ).toBe(true);
    for (const state of ["UNGRADED", "MISSING", "EXCUSED"])
      expect(
        recordScores.safeParse({
          expectedRevision: 0,
          entries: [{ ...entry, state }],
        }).success,
      ).toBe(false);
    expect(
      recordScores.safeParse({
        expectedRevision: 0,
        entries: [{ ...entry, score: 3.14159 }],
      }).success,
    ).toBe(false);
  });
  it("rejects impossible attendance dates and unlinked milestone items", () => {
    expect(
      recordSession.safeParse({
        expectedRevision: 0,
        title: "Class",
        date: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      recordSession.safeParse({
        expectedRevision: 0,
        title: "Class",
        date: "2026-11-02",
      }).success,
    ).toBe(true);
    expect(
      recordItem.safeParse({
        expectedRevision: 0,
        title: "Paper",
        kind: "MILESTONE",
        maxPoints: 100,
      }).success,
    ).toBe(false);
  });
});
