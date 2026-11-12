import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../middleware/auth.js";

const findConsultations = vi.hoisted(() => vi.fn());
vi.mock("../lib/prisma.js", () => ({
  prisma: { consultation: { findMany: findConsultations } },
}));
vi.mock("../middleware/auth.js", () => ({ requireAuth: vi.fn() }));

import router from "./consultation.routes.js";

async function list(workspace: string, roles: AuthenticatedUser["roles"], collegeId: string | null = "college-a", filters = {}) {
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
    query: { collegeId: "college-b", ...filters },
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

  it("filters Dean history by the entire selected Manila day, outcome, and project within the active college", async () => {
    const { next } = await list("dean", ["DEAN"], "college-a", {
      view: "history", from: "2026-11-09", to: "2026-11-09", search: " Campus ", status: "CANCELLED", page: "2",
    });
    expect(next).not.toHaveBeenCalled();
    expect(findConsultations).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        research: {
          collegeId: "college-a",
          OR: [
            { groupName: { contains: "Campus", mode: "insensitive" } },
            { title: { contains: "Campus", mode: "insensitive" } },
          ],
        },
        scheduledStart: { gte: new Date("2026-11-08T16:00:00Z"), lt: new Date("2026-11-09T16:00:00Z") },
        status: "CANCELLED",
      },
      skip: 25,
      select: expect.objectContaining({
        meetingUrl: false,
        research: { select: {
          title: true,
          groupName: true,
          members: {
            where: { projectRole: "ADVISER", leftAt: null },
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        } },
      }),
    }));
  });

  it("keeps past sessions without a recorded outcome separate from completed and cancelled sessions", async () => {
    await list("dean", ["DEAN"], "college-a", { view: "history" });
    const unresolved = {
      scheduledEnd: { lte: expect.any(Date) },
      status: { in: ["REQUESTED", "PROVISIONING", "SCHEDULED", "ONGOING"] },
    };
    expect(findConsultations.mock.calls[0][0].where.OR).toEqual([
      { status: { in: ["COMPLETED", "CANCELLED"] } },
      unresolved,
    ]);
    await list("dean", ["DEAN"], "college-a", { view: "history", status: "UNRECORDED" });
    expect(findConsultations.mock.calls[1][0].where).toEqual({ research: { collegeId: "college-a" }, ...unresolved });
  });

  it.each([
    { from: "2026-02-30" },
    { from: "2026-11-09", to: "2026-11-08" },
    { status: "SCHEDULED" },
  ])("rejects invalid history filters %j before querying records", async (filters) => {
    const { next } = await list("dean", ["DEAN"], "college-a", { view: "history", ...filters });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(findConsultations).not.toHaveBeenCalled();
  });

  it("limits the Coordinator view to direct invitations in the active college", async () => {
    await list("coordinator", ["RESEARCH_COORDINATOR", "PANELIST"]);
    expect(findConsultations.mock.calls[0][0].where).toMatchObject({
      research: { collegeId: "college-a" }, participants: { some: { userId: "faculty-a" } },
    });
  });

  it("includes completed supervised projects in Coordinator history within the active college", async () => {
    const { next } = await list("coordinator", ["RESEARCH_COORDINATOR"], "college-a", { view: "history", status: "COMPLETED" });
    expect(next).not.toHaveBeenCalled();
    expect(findConsultations).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [
        { OR: [
          { research: { collegeId: "college-a" }, participants: { some: { userId: "faculty-a" } } },
          { status: "COMPLETED", research: { collegeId: "college-a", OR: [
            { members: { some: { userId: "faculty-a", leftAt: null, projectRole: "COORDINATOR" } } },
            { workflowInstance: { is: { workflow: { createdBy: "faculty-a" } } } },
          ] } },
        ] },
        { status: "COMPLETED" },
      ] },
      select: expect.objectContaining({ meetingUrl: false }),
    }));
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
