import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "admin" } }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data:
      queryKey[0] === "system-users"
        ? {
            users: [
              {
                id: "current",
                universityId: "CURRENT-USER",
                email: "current@example.com",
                firstName: "Current",
                lastName: "User",
                status: "ACTIVE",
                roles: [],
              },
              {
                id: "suspended",
                universityId: "SUSPENDED-USER",
                email: "suspended@example.com",
                firstName: "Suspended",
                lastName: "User",
                status: "SUSPENDED",
                roles: [],
              },
              {
                id: "archived",
                universityId: "ARCHIVED-USER",
                email: "archived@example.com",
                firstName: "Archived",
                lastName: "User",
                status: "INACTIVE",
                roles: [],
              },
            ],
          }
        : { roles: [], colleges: [] },
    isLoading: false,
    isError: false,
  }),
}));
import { UserManagement } from "./UserManagement";

describe("archived user views", () => {
  it("keeps archived accounts out of the current list and replaces Delete with Archive", () => {
    const html = renderToStaticMarkup(<UserManagement />);
    expect(html).toContain("CURRENT-USER");
    expect(html).toContain("SUSPENDED-USER");
    expect(html).not.toContain("ARCHIVED-USER");
    expect(html).toContain(">Archive</button>");
    expect(html).toContain(">Suspend</button>");
    expect(html).not.toContain(">Delete</button>");
  });
  it("shows only archived accounts with details and verified restoration", () => {
    const html = renderToStaticMarkup(
      <UserManagement initialStatus="INACTIVE" />,
    );
    expect(html).toContain("ARCHIVED-USER");
    expect(html).not.toContain("CURRENT-USER");
    expect(html).not.toContain("SUSPENDED-USER");
    expect(html).toContain("Verify &amp; restore");
    expect(html).toContain("ARCHIVED</span>");
    expect(html).not.toContain(">Archive</button>");
    expect(html).not.toContain(">Suspend</button>");
  });
});
