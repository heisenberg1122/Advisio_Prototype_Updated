import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  createResearchTeam,
  joinResearchTeam,
  startTeamResearch,
  researcherContextKeys,
} from "./researcher-lifecycle-actions";
import { resolveResearcherLifecycle } from "./researcher-lifecycle";
import { createSingleFlightRunner } from "../hooks/use-async-action";

afterEach(() => vi.unstubAllGlobals());
const client = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });
const result = {
  project: {
    id: "p",
    title: "Team Research Study",
    cohortId: "c",
    workspaceId: "t",
    isTitleProvisional: true,
  },
  workflowInstance: { id: "i", workflowId: "pinned", currentStageId: "first" },
  created: true,
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("research team actions and cache transitions", () => {
  it("creates only the cohort-linked team, never a case", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        respond(
          { workspace: { id: "t", cohortId: "c", name: "Team", members: [] } },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const cache = client();
    const input = {
      cohortId: "c",
      name: "Team",
      participationMode: "GROUP" as const,
      accessMode: "INVITE_ONLY" as const,
    };
    await createResearchTeam(cache, input);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/workspaces");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(input);
    expect(cache.getQueryData(["student-research"])).toBeUndefined();
    expect(cache.getQueryData(["student-workspaces"])).toMatchObject({
      workspaces: [{ id: "t", cohortId: "c" }],
    });
    cache.clear();
  });
  it("joins a team without creating research or modifying process access", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(respond({ workspace: { id: "t", cohortId: "c" } }));
    vi.stubGlobal("fetch", fetch);
    const cache = client();
    const invalidate = vi.spyOn(cache, "invalidateQueries");
    await joinResearchTeam(cache, " abc123 ");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/workspaces/join/ABC123");
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
    expect(cache.getQueryData(["student-research"])).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["student-workspaces"],
    });
    cache.clear();
  });
  it.each([201, 200])(
    "transitions to the returned case for HTTP %s without registration metadata",
    async (status) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(
          respond({ ...result, created: status === 201 }, status),
        );
      vi.stubGlobal("fetch", fetch);
      const cache = client();
      const invalidate = vi.spyOn(cache, "invalidateQueries");
      await startTeamResearch(cache, "t");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe("/api/workspaces/t/start-research");
      expect(fetch.mock.calls[0][1]).toMatchObject({
        method: "POST",
        body: undefined,
      });
      for (const key of researcherContextKeys)
        expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
      const projects = cache.getQueryData<{ projects: any[] }>([
        "student-research",
      ])!.projects;
      expect(
        resolveResearcherLifecycle({
          cohorts: [],
          teams: [],
          projects,
          userId: "leader",
          projectId: result.project.id,
        }),
      ).toMatchObject({
        state: "RESEARCH_CASE_ACTIVE",
        project: {
          id: "p",
          isTitleProvisional: true,
          workflowInstance: { workflowId: "pinned" },
        },
        canStart: false,
      });
      cache.clear();
    },
  );
  it("preserves full cached case details when an idempotent response is scalar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respond({ ...result, created: false })),
    );
    const cache = client();
    cache.setQueryData(["student-research"], {
      projects: [
        {
          ...result.project,
          members: [{ userId: "leader" }],
          workflowInstance: {
            ...result.workflowInstance,
            workflow: { id: "pinned", stages: [{ id: "first" }] },
          },
        },
      ],
    });
    await startTeamResearch(cache, "t");
    expect(cache.getQueryData(["student-research"])).toMatchObject({
      projects: [
        {
          members: [{ userId: "leader" }],
          workflowInstance: {
            currentStageId: "first",
            workflow: { stages: [{ id: "first" }] },
          },
        },
      ],
    });
    cache.clear();
  });
  it("does not create cached cases or repair access on rejection", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(respond({ error: "WORKFLOW_ACCESS_REVOKED" }, 403));
    vi.stubGlobal("fetch", fetch);
    const cache = client();
    await expect(startTeamResearch(cache, "t")).rejects.toThrow(
      "WORKFLOW_ACCESS_REVOKED",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cache.getQueryData(["student-research"])).toBeUndefined();
    cache.clear();
  });
  it("the UI's single-flight runner prevents duplicate start submissions", async () => {
    let finish!: (value: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const cache = client();
    const runner = createSingleFlightRunner();
    const first = runner.run(() => startTeamResearch(cache, "t"));
    const duplicate = runner.run(() => startTeamResearch(cache, "t"));
    expect(first).toBe(duplicate);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(respond(result, 201));
    await first;
    cache.clear();
  });
});
