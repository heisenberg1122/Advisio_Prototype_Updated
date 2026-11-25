// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
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
                college: { id: "cit", name: "College of Information Technology", code: "CIT" },
                program: { id: "bsit", name: "BS Information Technology", code: "BSIT" },
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
                id: "pending",
                universityId: "PENDING-USER",
                email: "pending@example.com",
                firstName: "Pending",
                lastName: "User",
                status: "PENDING",
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
        : {
            roles: [],
            colleges: [
              { id: "cit", name: "College of Information Technology", programs: [{ id: "bsit", name: "BS Information Technology" }] },
              { id: "cas", name: "College of Arts and Sciences", programs: [{ id: "bsbio", name: "BS Biology" }] },
            ],
          },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({
      user: {
        college: { id: "cas", name: "College of Arts and Sciences" },
        program: { id: "bsbio", name: "BS Biology" },
      },
    }),
  },
  ApiError: Error,
}));
import { apiClient } from "@/lib/api-client";
import { UserManagement } from "./UserManagement";

describe("archived user views", () => {
  it("keeps archived accounts out of the current list and offers both pending decisions", () => {
    const html = renderToStaticMarkup(<UserManagement />);
    expect(html).toContain("CURRENT-USER");
    expect(html).toContain("SUSPENDED-USER");
    expect(html).not.toContain("ARCHIVED-USER");
    expect(html).toContain(">Verify &amp; approve</button>");
    expect(html).toContain(">Reject</button>");
  });
  it("shows only archived accounts with details and verified restoration", () => {
    const html = renderToStaticMarkup(
      <UserManagement initialStatus="INACTIVE" />,
    );
    expect(html).toContain("ARCHIVED-USER");
    expect(html).not.toContain("CURRENT-USER");
    expect(html).not.toContain("SUSPENDED-USER");
    expect(html).toContain("Verify &amp; restore");
    expect(html).toContain("Archived</span>");
    expect(html).not.toContain(">Archive</button>");
    expect(html).not.toContain(">Reject</button>");
  });
  it("opens the row menu above the page and requests confirmation before rejecting", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    const button = (label: string, within: ParentNode = document.body) =>
      [...within.querySelectorAll("button")].find((item) =>
        (item.querySelector(".sr-only") ?? item).textContent?.trim() === label,
      )!;
    try {
      await act(async () => root.render(<UserManagement />));
      const dots = container.querySelector<HTMLButtonElement>('[aria-label="More actions for Current User"]')!;
      await act(async () => dots.click());
      const menu = document.querySelector(".sa-menu")!;
      expect(menu.parentElement).toBe(document.body);
      expect(button("Suspend", menu).disabled).toBe(false);
      expect(button("Archive", menu).disabled).toBe(false);
      expect(document.activeElement).toBe(button("View details", menu));
      await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
      expect(document.querySelector(".sa-menu")).toBeNull();
      expect(document.activeElement).toBe(dots);

      await act(async () => button("Reject", container).click());
      const confirmation = button("Reject and archive", container);
      expect(confirmation.disabled).toBe(true);
      const reason = "Registration could not be verified.";
      const textarea = container.querySelector<HTMLTextAreaElement>("#account-action-reason")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, reason);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(confirmation.disabled).toBe(false);
      await act(async () => confirmation.click());
      expect(apiClient.post).toHaveBeenCalledWith("/api/users/pending/archive", { reason, pendingOnly: true });

      await act(async () => dots.click());
      await act(async () => button("Assign college and program").click());
      const college = container.querySelector<HTMLSelectElement>("#assigned-college")!;
      const program = container.querySelector<HTMLSelectElement>("#assigned-program")!;
      expect(college.value).toBe("cit");
      expect(program.value).toBe("bsit");
      await act(async () => {
        college.value = "cas";
        college.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(program.value).toBe("");
      expect([...program.options].map((option) => option.value)).toEqual(["", "bsbio"]);
      await act(async () => {
        program.value = "bsbio";
        program.dispatchEvent(new Event("change", { bubbles: true }));
        const note = container.querySelector<HTMLTextAreaElement>("#college-reason")!;
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(note, reason);
        note.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => button("Save assignment", container).click());
      expect(apiClient.patch).toHaveBeenCalledWith("/api/users/current/college", { collegeId: "cas", programId: "bsbio", reason });
      expect(container.textContent).toContain("College of Arts and Sciences · BS Biology");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  });
});
