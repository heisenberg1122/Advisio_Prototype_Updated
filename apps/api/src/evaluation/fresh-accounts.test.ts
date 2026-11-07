import { describe, expect, it, vi } from "vitest";
vi.mock("@research-management/database", () => ({
  seedReferenceData: vi.fn(async () => undefined),
}));
import { EVALUATION_COURSES, EVALUATION_ROLES } from "./catalog.js";
import {
  attachFreshAccounts,
  freshWorkspaceId,
  seedFreshAccounts,
  workspaceDatasetIds,
} from "./fresh-accounts.js";
import { schemaName } from "./config.js";
import { scenarioTasks } from "./scenarios.js";
import type { WorkspaceAccounts } from "./seed.js";

describe("fresh-account dataset", () => {
  it("derives a separate private schema from a validated session ID", () => {
    const id = "a".repeat(32),
      other = "b".repeat(32);
    expect(freshWorkspaceId(id)).toMatch(/^[a-f0-9]{32}$/);
    expect(freshWorkspaceId(id)).not.toBe(id);
    expect(freshWorkspaceId(id)).not.toBe(freshWorkspaceId(other));
    expect(freshWorkspaceId(id)).toBe(freshWorkspaceId(id));
    expect(workspaceDatasetIds(id).map(schemaName)).toEqual([
      `eval_${id}`,
      `eval_${freshWorkspaceId(id)}`,
    ]);
    for (const invalid of [
      "public",
      "../production",
      "a".repeat(31),
      "A".repeat(32),
    ])
      expect(() => workspaceDatasetIds(invalid)).toThrow(
        "Invalid evaluation workspace identity",
      );
  });

  it.each(EVALUATION_COURSES)(
    "creates only reference data and five fresh identities for $id",
    async (course) => {
      const writes: Record<string, any[]> = {};
      const create = (model: string, returned?: object) =>
        vi.fn(async (args: any) => {
          (writes[model] ||= []).push(args.data);
          return returned || { id: args.data.email };
        });
      // Unknown delegates throw: no project, enrollment, signature, review, message,
      // defense, document, notification or grade may be created in fresh mode.
      const delegates = {
        college: {
          findUniqueOrThrow: vi.fn(async () => ({
            id: "college",
            name: course.college,
          })),
        },
        program: { findFirstOrThrow: vi.fn(async () => ({ id: "program" })) },
        academicYear: { create: create("year", { id: "year" }) },
        researchType: { create: create("researchType", { id: "type" }) },
        role: {
          findMany: vi.fn(async () =>
            EVALUATION_ROLES.map((role) => ({
              id: role.id,
              name: role.institutionalRole,
            })),
          ),
        },
        user: { create: create("user") },
        researcherProfile: {
          create: create("researcherProfile", { id: "researcher-profile" }),
        },
        facultyProfile: {
          create: create("facultyProfile", { id: "faculty-profile" }),
        },
      };
      const db = new Proxy(delegates, {
        get(target, key) {
          if (!(key in target))
            throw new Error(
              "Unexpected fresh-account delegate: " + String(key),
            );
          return target[key as keyof typeof target];
        },
      });
      const accounts = await seedFreshAccounts(db as never, course);
      expect(Object.keys(accounts)).toHaveLength(5);
      expect(
        new Set(Object.values(accounts).map((account) => account.userId)).size,
      ).toBe(5);
      expect(writes.user).toHaveLength(5);
      expect(writes.researcherProfile).toEqual([
        expect.objectContaining({
          researchStatus: "NO_PROJECT",
          status: "NOT_STARTED",
          interests: [],
        }),
      ]);
      expect(writes.researcherProfile[0]).not.toHaveProperty("submittedAt");
      expect(writes.facultyProfile).toHaveLength(4);
      expect(Object.keys(writes).sort()).toEqual([
        "facultyProfile",
        "researchType",
        "researcherProfile",
        "user",
        "year",
      ]);
      expect(delegates.program.findFirstOrThrow).toHaveBeenCalledWith({
        where: { code: course.id, collegeId: "college" },
      });
      for (const role of EVALUATION_ROLES) {
        expect(accounts[role.id]).toMatchObject({
          id: "fresh-account",
          label: "Fresh account",
          projectId: null,
          defenseId: null,
          home: role.home,
        });
        expect(accounts[role.id].projectIds).toBeUndefined();
        expect(
          writes.user.find((user) => user.email === accounts[role.id].userId),
        ).toMatchObject({
          collegeId: "college",
          programId: "program",
          status: "ACTIVE",
          roles: { create: { roleId: role.id } },
          collegeMemberships: {
            create: {
              collegeId: "college",
              roleNames: [role.institutionalRole],
            },
          },
        });
        expect(scenarioTasks(role.id, "fresh-account", [])).toHaveLength(6);
      }
      const base = Object.fromEntries(
        EVALUATION_ROLES.map((role) => [
          role.id,
          {
            userId: "existing-" + role.id,
            projectId: "existing-project",
            title: "Existing sample",
            defenseId: null,
            projectIds: ["existing-project"],
            scenarios: [
              {
                id: "original",
                label: "Original sample",
                userId: "existing-" + role.id,
                projectId: "existing-project",
                title: "Existing sample",
                defenseId: null,
                projectIds: ["existing-project"],
                home: role.home,
              },
            ],
          },
        ]),
      ) as WorkspaceAccounts;
      const before = JSON.parse(JSON.stringify(base));
      attachFreshAccounts(base, accounts);
      for (const role of EVALUATION_ROLES) {
        expect(base[role.id].scenarios).toHaveLength(2);
        expect(base[role.id].scenarios![0]).toEqual(
          before[role.id].scenarios[0],
        );
        expect(base[role.id].userId).toBe(before[role.id].userId);
        expect(base[role.id].projectIds).toEqual(before[role.id].projectIds);
        expect(base[role.id].scenarios![1]).toEqual(accounts[role.id]);
      }
    },
  );
});
