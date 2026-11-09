// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import FacultyConsultationsPage from "./FacultyConsultationsPage";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: api }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: "dean", college: { id: "college" } } }) }));

it("renders a dean’s private invitation after a fresh load and rechecks the saved link on join", async () => {
  const now = { scheduledStart: "2098-07-12T02:00:00Z", scheduledEnd: "2098-07-12T03:00:00Z" };
  const meetingUrl = "https://meet.google.com/abc-defg-hij";
  api.get.mockResolvedValue({ hasNextPage: false, consultations: [
    { id: "private", title: "Oversight record", ...now, status: "SCHEDULED", research: { title: "Group A" } },
    { id: "invited", title: "Direct invitation", ...now, status: "SCHEDULED", meetingUrl, research: { title: "Group B" } },
  ] });
  api.post.mockResolvedValue({ meetingUrl });
  const popup = { opener: window, close: vi.fn(), location: { replace: vi.fn() } };
  const open = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  try {
    for (let load = 0; load < 2; load += 1) {
      const client = new QueryClient();
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      try {
        await act(async () => {
          root.render(<QueryClientProvider client={client}><MemoryRouter>
            <FacultyConsultationsPage workspace="dean" />
          </MemoryRouter></QueryClientProvider>);
        });
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
        const rows = [...host.querySelectorAll("li")];
        expect(rows.find((row) => row.textContent?.includes("Oversight record"))?.textContent).not.toContain("Join Meet");
        const invitation = rows.find((row) => row.textContent?.includes("Direct invitation"));
        const join = [...(invitation?.querySelectorAll("button") || [])].find((button) => button.textContent?.includes("Join Meet"));
        expect(join).toBeDefined();
        await act(async () => join!.click());
        expect(api.post).toHaveBeenLastCalledWith("/api/consultations/invited/join", {});
        expect(popup.opener).toBeNull();
        expect(popup.location.replace).toHaveBeenLastCalledWith(meetingUrl);
        if (load === 1) {
          const history = host.querySelector<HTMLButtonElement>('[aria-label="Consultation view"] button[aria-pressed="false"]');
          expect(history).not.toBeNull();
          await act(async () => history!.click());
          await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
          expect(api.get).toHaveBeenLastCalledWith("/api/consultations/workspace/dean", {
            params: expect.objectContaining({ page: 1, view: "history" }),
          });
          expect(host.textContent).toContain("Consultation history");
          expect(host.textContent).not.toContain("Join Meet");
        }
      } finally {
        await act(async () => root.unmount());
        client.clear();
        host.remove();
      }
    }
    expect(api.get).toHaveBeenCalledTimes(3);
  } finally {
    open.mockRestore();
    vi.unstubAllGlobals();
  }
});
