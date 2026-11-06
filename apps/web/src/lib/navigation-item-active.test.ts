import { describe, expect, it } from "vitest";
import { navigationItemActive } from "./navigation-item-active";

describe("workspace navigation destinations", () => {
  it("keeps Home inactive when another dashboard tab is open", () => {
    const home = { href: "/adviser/dashboard", tabName: "overview" };
    expect(navigationItemActive(home, "/adviser/dashboard", "?tab=advisees")).toBe(false);
    expect(navigationItemActive(home, "/adviser/dashboard", "")).toBe(true);
  });
  it("matches tabs regardless of unrelated query parameters", () => {
    const reviews = { href: "/panelist/documents?tab=official" };
    expect(navigationItemActive(reviews, "/panelist/documents", "?projectId=p1&tab=official")).toBe(true);
    expect(navigationItemActive(reviews, "/panelist/documents", "?tab=drafts")).toBe(false);
  });
  it("matches nested pages without highlighting a different role", () => {
    const reviews = { href: "/professor/reviews" };
    expect(navigationItemActive(reviews, "/professor/reviews/d1/", "")).toBe(true);
    expect(navigationItemActive(reviews, "/panelist/reviews", "")).toBe(false);
  });
  it("respects role-specific explicit active overrides", () => {
    expect(navigationItemActive({ href: "/adviser/dashboard", active: true }, "/adviser/advisees/p1", "")).toBe(true);
    expect(navigationItemActive({ href: "/admin/reviews", active: false }, "/admin/reviews", "")).toBe(false);
  });
});
