import { describe, expect, it, vi } from "vitest";
vi.mock("../lib/prisma.js", () => ({ prisma: {} }));
import { authorizedMailRecipientWhere } from "./mail-access.service.js";

describe("retired office mail access", () => {
  it.each([
    { roles: [] },
    { roles: ["VPAA"] },
    { roles: ["REB"] },
    { roles: ["RPO"] },
  ])(
    "does not treat unsupported roles $roles as faculty",
    async ({ roles }) => {
      expect(
        await authorizedMailRecipientWhere({
          id: "former-officer",
          roles,
        } as any),
      ).toEqual({ id: { in: [] }, status: "ACTIVE" });
    },
  );
});
