import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: (options: any) => options }));
vi.mock("@/lib/api-client", () => ({ apiClient: { get: state.get } }));
vi.mock("@/providers/active-project-provider", () => ({
  useActiveProject: vi.fn(),
  useActiveProjectContext: () => ({ activeProjectId: "group" }),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: vi.fn() }));

import { useDefense } from "./use-student";

describe("researcher defense readiness", () => {
  let readiness: { workflowApproved: boolean; deanApprovalSigned: boolean };
  beforeEach(() => {
    readiness = { workflowApproved: true, deanApprovalSigned: false };
    state.get.mockImplementation(async (url: string) => {
      if (url === "/api/research") return { projects: [{
        id: "group",
        workflowInstance: { completedAt: null },
        members: [{ projectRole: "ADVISER" }],
        taskSubmissions: [{ status: "APPROVED" }],
      }] };
      if (url.endsWith("/manuscript-workflow")) return { defenseReadiness: readiness };
      if (url.endsWith("/documents")) return { documents: [] };
      return { sessions: [] };
    });
  });

  const load = () => (useDefense() as unknown as { queryFn: () => Promise<any> }).queryFn();

  it("checks an approved Title Defense gate before the whole workflow finishes", async () => {
    const result = await load();
    expect(result.requirements.find((item: any) => item.id === "workflow").status).toBe("done");
    expect(result.requirements.find((item: any) => item.id === "dean-approval").status).toBe("pending");
    expect(result.eligibility).toBe("not_eligible");
  });

  it("becomes ready when the current cycle's Dean approval is signed", async () => {
    readiness.deanApprovalSigned = true;
    expect((await load()).eligibility).toBe("eligible");
  });

  it("keeps the next cycle in progress until its gate is approved", async () => {
    readiness.workflowApproved = false;
    const result = await load();
    expect(result.requirements.find((item: any) => item.id === "workflow").status).toBe("in_progress");
    expect(result.eligibility).toBe("not_eligible");
  });
});
