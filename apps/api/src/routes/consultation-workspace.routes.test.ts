import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../middleware/auth.js";

const findConsultations = vi.hoisted(() => vi.fn());
vi.mock("../lib/prisma.js", () => ({
  prisma: { consultation: { findMany: findConsultations } },
}));
vi.mock("../middleware/auth.js", () => ({ requireAuth: vi.fn() }));

import router from "./consultation.routes.js";

async function list(workspace: string, roles: AuthenticatedUser["roles"], collegeId: string | null = "college-a") {
  const layer = router.stack.find((entry) => entry.route?.path === "/workspace/:workspace");
  const handler = layer?.route?.stack.at(-1)?.handle;
  if (!handler) throw new Error("The consultation workspace route was not registered.");
  let done!: () => void;
  const completed = new Promise<void>((resolve) => { done = resolve; });
  const response = {
    json: vi.fn(() => done()),
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
  const next = vi.fn(() => done());
  handler({
    user: { id: "faculty-a", collegeId, roles },
    params: { workspace },
    query: { collegeId: "college-b" },
  } as unknown as Request, response as unknown as Response, next);
  await completed;
  return { response, next };
}

describe("faculty consultation workspaces", () => {
  beforeEach(() => {
    findConsultations.mockReset().mockResolvedValue([]);
  });

  it("allows college oversight but only exposes a join link to an invited dean", async () => {
    const meetingUrl = "https://meet.google.com/abc-defg-hij";
    const event = { id: "consultation", title: "College consultation", status: "SCHEDULED", meetingUrl, research: { title: "Project" } };
    findConsultations.mockResolvedValue([{ ...event, participants: [] }, { ...event, id: "invited", participants: [{ userId: "faculty-a", attendanceStatus: "INVITED" }] }]);
    const { response, next } = await list("dean", ["DEAN"]);
    expect(next).not.toHaveBeenCalled();
    const [{ where, select }] = findConsultations.mock.calls[0];
    expect(where.research).toEqual({ collegeId: "college-a" });
    expect(select.participants.where).toEqual({ userId: "faculty-a" });
    for (const field of ["notes", "description"]) {
      expect(select[field]).toBeUndefined();
    }
    expect(response.json).toHaveBeenCalledWith({
      consultations: [
        expect.not.objectContaining({ meetingUrl: expect.anything() }),
        expect.objectContaining({ meetingUrl, attendanceStatus: "INVITED" }),
      ],
      hasNextPage: false,
    });
  });

  it("limits the Panelist view to direct invitations in the active college", async () => {
    await list("panelist", ["PANELIST", "DEAN"]);
    expect(findConsultations.mock.calls[0][0].where).toMatchObject({
      research: { collegeId: "college-a" }, participants: { some: { userId: "faculty-a" } },
    });
  });

  it("limits the Coordinator view to direct invitations in the active college", async () => {
    await list("coordinator", ["RESEARCH_COORDINATOR", "PANELIST"]);
    expect(findConsultations.mock.calls[0][0].where).toMatchObject({
      research: { collegeId: "college-a" }, participants: { some: { userId: "faculty-a" } },
    });
  });

  it.each([
    ["dean", ["PANELIST"]],
    ["coordinator", ["DEAN"]],
    ["panelist", ["ADVISER"]],
  ] as const)("rejects requests to the %s view from unrelated roles", async (workspace, roles) => {
    const { next } = await list(workspace, [...roles]);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(findConsultations).not.toHaveBeenCalled();
  });

  it("requires an active college before exposing Dean records", async () => {
    const { next } = await list("dean", ["DEAN"], null);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(findConsultations).not.toHaveBeenCalled();
  });
});
