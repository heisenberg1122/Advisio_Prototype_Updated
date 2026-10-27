import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ researchWorkspace: { findUnique: vi.fn() } }));
const provision = vi.hoisted(() => vi.fn());
vi.mock("../lib/prisma.js", async (original) => ({
  ...(await original<any>()),
  prisma: db,
}));
vi.mock(
  "../services/research-case-provisioning.service.js",
  async (original) => ({
    ...(await original<any>()),
    provisionResearchCase: provision,
  }),
);
import router from "./workspace-research.routes.js";
import {
  ResearchCaseProvisioningError,
  type ResearchCaseProvisioningErrorCode,
} from "../services/research-case-provisioning.service.js";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const cohortId = "10000000-0000-4000-8000-000000000002";
const actorId = "10000000-0000-4000-8000-000000000003";
const handler = (router as any).stack
  .find((layer: any) => layer.route?.path === "/:id/start-research")
  .route.stack.at(-1).handle;
async function start(roles = ["RESEARCHER"], query = {}) {
  const res = {
    statusCode: 200,
    body: {} as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  };
  await handler(
    { params: { id: workspaceId }, user: { id: actorId, roles }, query },
    res,
  );
  return res;
}
beforeEach(() => {
  vi.resetAllMocks();
  db.researchWorkspace.findUnique.mockResolvedValue({
    cohortId,
    members: [{ role: "LEADER" }],
  });
  provision.mockResolvedValue({
    project: { id: "case" },
    workflowInstance: { id: "instance" },
    created: true,
  });
});
describe("explicit workspace research start", () => {
  it("uses only server-derived cohort, path workspace and authenticated actor IDs", async () => {
    expect(await start()).toMatchObject({
      statusCode: 201,
      body: {
        project: { id: "case" },
        workflowInstance: { id: "instance" },
        created: true,
      },
    });
    expect(provision).toHaveBeenCalledExactlyOnceWith({
      cohortId,
      workspaceId,
      actorId,
    });
    expect(db.researchWorkspace.findUnique).toHaveBeenCalledWith({
      where: { id: workspaceId },
      select: {
        cohortId: true,
        members: {
          where: { userId: actorId, leftAt: null },
          select: { role: true },
        },
      },
    });
  });
  it("returns 200 for a reused case without changing the domain response", async () => {
    provision.mockResolvedValue({
      project: { id: "existing" },
      workflowInstance: { id: "pinned" },
      created: false,
    });
    expect(await start()).toMatchObject({
      statusCode: 200,
      body: {
        created: false,
        project: { id: "existing" },
        workflowInstance: { id: "pinned" },
      },
    });
  });
  it.each([{ members: [] }, { members: [{ role: "MEMBER" }] }])(
    "rejects outsiders, departed leaders and ordinary members before provisioning: %j",
    async ({ members }) => {
      db.researchWorkspace.findUnique.mockResolvedValue({ cohortId, members });
      expect((await start()).statusCode).toBe(403);
      expect(provision).not.toHaveBeenCalled();
    },
  );
  it("requires a researcher role even for a staff workspace leader", async () => {
    expect((await start(["SYSTEM_ADMIN"])).statusCode).toBe(403);
    expect(db.researchWorkspace.findUnique).not.toHaveBeenCalled();
    expect(provision).not.toHaveBeenCalled();
  });
  it("returns not found for missing workspaces", async () => {
    db.researchWorkspace.findUnique.mockResolvedValue(null);
    expect((await start()).statusCode).toBe(404);
    expect(provision).not.toHaveBeenCalled();
  });
  it("rejects cohort-null legacy workspaces without attaching them", async () => {
    db.researchWorkspace.findUnique.mockResolvedValue({
      cohortId: null,
      members: [{ role: "LEADER" }],
    });
    expect((await start()).statusCode).toBe(409);
    expect(provision).not.toHaveBeenCalled();
  });
  it("rejects query metadata instead of treating it as configuration", async () => {
    expect(
      (await start(["RESEARCHER"], { cohortId: "override" })).statusCode,
    ).toBe(400);
    expect(provision).not.toHaveBeenCalled();
  });
  it.each([
    ["INVALID_PROVISIONING_INPUT", 400],
    ["COHORT_NOT_FOUND", 404],
    ["WORKSPACE_NOT_FOUND", 404],
    ["ACTOR_NOT_COHORT_MEMBER", 403],
    ["ACTOR_NOT_WORKSPACE_MEMBER", 403],
    ["ACTOR_NOT_WORKSPACE_LEADER", 403],
    ["COHORT_NOT_ACTIVE", 409],
    ["COHORT_PROCESS_NOT_ASSIGNED", 409],
    ["COHORT_PROCESS_NOT_FOUND", 409],
    ["COHORT_PROCESS_NOT_PUBLISHED", 409],
    ["WORKSPACE_COHORT_MISMATCH", 409],
    ["TEAM_MEMBER_NOT_IN_COHORT", 409],
    ["TEAM_MEMBER_NOT_ELIGIBLE", 409],
    ["INVALID_TEAM_LEADERSHIP", 409],
    ["WORKFLOW_ACCESS_REVOKED", 409],
    ["WORKFLOW_ACCESS_MISSING", 409],
    ["INVALID_ACADEMIC_SCOPE", 409],
    ["NO_ACTIVE_WORKFLOW_STAGE", 409],
    ["MULTIPLE_RESEARCH_CASES", 409],
    ["EXISTING_CASE_INCONSISTENT", 409],
  ] as Array<[ResearchCaseProvisioningErrorCode, number]>)(
    "maps %s to the existing API error envelope and status %s",
    async (code, status) => {
      provision.mockRejectedValue(new ResearchCaseProvisioningError(code));
      const response = await start();
      expect(response.statusCode).toBe(status);
      expect(response.body).toEqual({ error: expect.any(String) });
    },
  );
  it("gives a useful revocation message without changing authorization", async () => {
    provision.mockRejectedValue(
      new ResearchCaseProvisioningError("WORKFLOW_ACCESS_REVOKED"),
    );
    expect((await start()).body.error).toContain("coordinator");
  });
  it.each(["P2034", "P2002", "P2003", "P2025"])(
    "maps persistence conflict %s without exposing database details",
    async (code) => {
      provision.mockRejectedValue(
        Object.assign(new Error("private database detail"), { code }),
      );
      const response = await start();
      expect(response.statusCode).toBe(409);
      expect(response.body.error).not.toContain("private");
    },
  );
  it("does not expose unexpected error messages as API responses", async () => {
    provision.mockRejectedValue(new Error("private database detail"));
    expect(await start()).toMatchObject({
      statusCode: 500,
      body: { error: "Unable to start research." },
    });
  });
});
