import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), auth: vi.fn() }));
vi.mock("../middleware/auth.js", () => ({ requireAuth: mocks.auth }));
vi.mock("../services/google-drive.service.js", () => ({
  googleDriveService: { refreshStorage: mocks.refresh },
}));
import router from "./integration.routes.js";

const route = router.stack.find(
  (layer: any) =>
    layer.route?.path === "/integrations/google-drive/storage-refresh",
)!.route!;
beforeEach(() => vi.clearAllMocks());
describe("storage refresh authorization", () => {
  it("requires authentication middleware", () => {
    expect(route.stack[0].handle).toBe(mocks.auth);
  });
  it("rejects non-admins before retrieving any quota", async () => {
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await (route.stack[1].handle as any)(
      { user: { roles: ["RESEARCHER"] } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("lets system admins request a manual refresh", async () => {
    const res: any = { json: vi.fn() };
    mocks.refresh.mockResolvedValue({ quota: { usage: "10" } });
    await (route.stack[1].handle as any)(
      { user: { roles: ["SYSTEM_ADMIN"] }, body: { force: true } },
      res,
    );
    expect(mocks.refresh).toHaveBeenCalledWith(true);
    expect(res.json).toHaveBeenCalledWith({ quota: { usage: "10" } });
  });
});
