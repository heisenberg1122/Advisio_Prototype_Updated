import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  researchWorkspace: { findUnique: vi.fn(), delete: vi.fn() },
  researchProject: { count: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("../lib/prisma.js", async (original) => ({ ...(await original<any>()), prisma: db }));
import router from "./workspace.routes.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const deleteHandler = (router as any).stack.find(
  (layer: any) => layer.route?.path === "/:id" && layer.route.methods.delete,
).route.stack.at(-1).handle;

async function remove(roles = ["RESEARCHER"], id = workspaceId) {
  const res = {
    statusCode: 200,
    body: {} as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
  await deleteHandler({ params: { id }, user: { id: "leader", roles } }, res);
  return res;
}

describe("Workspace deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((action) => action(db));
    db.researchWorkspace.findUnique.mockResolvedValue({ id: workspaceId, members: [{ userId: "leader" }] });
    db.researchProject.count.mockResolvedValue(0);
  });

  it("deletes an empty workspace after checking active leadership and all projects", async () => {
    expect((await remove()).statusCode).toBe(200);
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(db.researchWorkspace.findUnique).toHaveBeenCalledWith({
      where: { id: workspaceId },
      include: { members: { where: { userId: "leader", role: "LEADER", leftAt: null } } },
    });
    expect(db.researchProject.count).toHaveBeenCalledWith({ where: { workspaceId } });
    expect(db.researchWorkspace.delete).toHaveBeenCalledWith({ where: { id: workspaceId } });
  });

  it("rejects members, former leaders, and outsiders", async () => {
    db.researchWorkspace.findUnique.mockResolvedValue({ id: workspaceId, members: [] });
    expect((await remove()).statusCode).toBe(403);
    expect(db.researchWorkspace.delete).not.toHaveBeenCalled();
  });

  it("protects workspaces containing projects, including archived or invisible projects", async () => {
    db.researchProject.count.mockResolvedValue(1);
    expect((await remove()).statusCode).toBe(409);
    expect(db.researchWorkspace.delete).not.toHaveBeenCalled();
  });

  it("returns not found if the workspace was already deleted", async () => {
    db.researchWorkspace.findUnique.mockResolvedValue(null);
    expect((await remove()).statusCode).toBe(404);
    expect(db.researchWorkspace.delete).not.toHaveBeenCalled();
  });

  it("rejects other roles and invalid IDs before accessing the database", async () => {
    expect((await remove(["ADVISER"])).statusCode).toBe(403);
    expect((await remove(["RESEARCHER"], "invalid")).statusCode).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("reports a database failure without claiming success", async () => {
    db.researchWorkspace.delete.mockRejectedValue(new Error("Deletion failed"));
    const res = await remove();
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("Deletion failed");
  });
});
