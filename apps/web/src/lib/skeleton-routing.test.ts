import { describe, expect, it } from "vitest";
import { contentSkeletonKindForPath } from "./skeleton-routing";

describe("skeleton route selection", () => {
  it.each([
    ["/student/dashboard", "dashboard"],
    ["/student/groups", "cards"],
    ["/student/documents", "files"],
    ["/professor/reviews", "table"],
    ["/panelist/profile", "profile"],
    ["/admin/notifications", "notifications"],
    ["/adviser/calendar", "calendar"],
    ["/system-admin/settings", "form"],
    ["/professor/inbox", "mail"],
  ] as const)("maps %s to the %s skeleton", (pathname, expected) => {
    expect(contentSkeletonKindForPath(pathname)).toBe(expected);
  });

  it("checks dashboard before role words such as panelist", () => {
    expect(contentSkeletonKindForPath("/panelist/dashboard")).toBe(
      "dashboard",
    );
  });
});
