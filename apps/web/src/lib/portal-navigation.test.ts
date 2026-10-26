import { describe, expect, it } from "vitest";
import { portalPrefixForPath, portalQuickLinks } from "./portal-navigation";

describe("role-aware portal navigation", () => {
  it("keeps system administration out of the student route family", () => {
    expect(portalPrefixForPath("/system-admin/dashboard")).toBe(
      "/system-admin",
    );
    expect(
      portalQuickLinks("/system-admin/dashboard").some((item) =>
        item.href.startsWith("/student"),
      ),
    ).toBe(false);
  });

  it("routes every faculty document link to that faculty portal", () => {
    for (const prefix of ["/adviser", "/professor", "/panelist"] as const) {
      const document = portalQuickLinks(`${prefix}/dashboard`).find(
        (item) => item.id === "documents",
      );
      expect(document?.href).toBe(`${prefix}/documents`);
    }
  });

  it("only exposes the administrative official-document workspace to DEAN or VPAA", () => {
    expect(
      portalQuickLinks("/admin/dashboard", ["REB"]).some(
        (item) => item.id === "documents",
      ),
    ).toBe(false);
    expect(
      portalQuickLinks("/admin/dashboard", ["DEAN"]).find(
        (item) => item.id === "documents",
      )?.href,
    ).toBe("/admin/documents?tab=official");
  });
});
