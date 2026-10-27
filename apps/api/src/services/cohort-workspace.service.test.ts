import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
  researchCohort: { findUnique: vi.fn() },
  user: { findFirst: vi.fn() },
  researchWorkspace: { create: vi.fn() },
}));
vi.mock("../lib/prisma.js", async (original) => ({
  ...(await original<any>()),
  prisma: db,
}));
import {
  createCohortWorkspace,
  requireCohortTeamMembership,
} from "./cohort-workspace.service.js";
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  db.researchCohort.findUnique.mockResolvedValue({
    id: "cohort",
    collegeId: "college",
    programId: "program",
    status: "ACTIVE",
    members: [{ userId: "researcher" }],
  });
  db.user.findFirst.mockResolvedValue({ id: "researcher" });
  db.researchWorkspace.create.mockResolvedValue({ id: "team" });
});
describe("cohort-linked team formation without provisioning", () => {
  it("derives academic scope from the validated cohort and creates only a workspace with its leader", async () => {
    expect(
      await createCohortWorkspace({
        cohortId: "cohort",
        actorId: "researcher",
        name: "Team",
        participationMode: "GROUP",
        accessMode: "INVITE_ONLY",
      }),
    ).toEqual({ id: "team" });
    expect(db.researchWorkspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cohortId: "cohort",
        collegeId: "college",
        programId: "program",
        createdBy: "researcher",
        name: "Team",
        participationMode: "GROUP",
        inviteCodeEnabled: true,
        members: { create: { userId: "researcher", role: "LEADER" } },
      }),
      include: expect.any(Object),
    });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });
  it.each([null, { id: "cohort", members: [] }])(
    "requires active cohort membership %j",
    async (cohort) => {
      db.researchCohort.findUnique.mockResolvedValue(cohort);
      await expect(
        requireCohortTeamMembership(db as any, "cohort", "researcher"),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(db.researchWorkspace.create).not.toHaveBeenCalled();
    },
  );
  it.each(["DRAFT", "CLOSED", "ARCHIVED"])(
    "rejects team formation/join in a %s cohort",
    async (status) => {
      db.researchCohort.findUnique.mockResolvedValue({
        id: "cohort",
        members: [{ userId: "researcher" }],
        status,
      });
      await expect(
        requireCohortTeamMembership(db as any, "cohort", "researcher"),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(db.researchWorkspace.create).not.toHaveBeenCalled();
    },
  );
  it("requires an active researcher account in the cohort's exact active academic scope", async () => {
    db.user.findFirst.mockResolvedValue(null);
    await expect(
      requireCohortTeamMembership(db as any, "cohort", "researcher"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "researcher",
        status: "ACTIVE",
        collegeId: "college",
        programId: "program",
        roles: { some: { role: { name: "RESEARCHER" } } },
      }),
      select: { id: true },
    });
    expect(db.researchWorkspace.create).not.toHaveBeenCalled();
  });
});
