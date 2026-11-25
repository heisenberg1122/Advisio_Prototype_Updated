// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ConsultationRecordButton } from "./ConsultationRecordButton";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: api }));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "viewer", college: { id: "college" } } }),
}));

it("shows the assigned review and fetches fresh proof after a reload", async () => {
  const start = "2026-07-01T06:04:00Z";
  const end = "2026-07-01T06:32:00Z";
  const overview = {
    title: "Methods review", project: "Group A",
    scheduledStart: "2026-07-01T06:00:00Z", scheduledEnd: "2026-07-01T07:00:00Z",
    reviewers: [],
  };
  const confirmed = {
    ...overview,
    proof: {
      status: "confirmed", reference: "CR-TEST", actualStart: start, actualEnd: end,
      durationMinutes: 28, submittedBy: "Adviser", submittedAt: end,
      confirmedBy: "Researcher", confirmedAt: end,
    },
    canReview: false,
  };
  const details = {
    revision: 2, actualStart: start, actualEnd: end, summary: "Shared research notes",
    nextSteps: "Update the draft", submittedBy: "Adviser", reviewerId: "viewer",
    reviewer: "Researcher", correction: null,
  };
  api.get.mockResolvedValueOnce({
    ...overview, proof: { status: "awaiting_confirmation" }, canReview: true, details,
  }).mockResolvedValueOnce({ ...confirmed, details: null });
  api.patch.mockResolvedValueOnce({ ...confirmed, details });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const button = (label: string) => [...host.querySelectorAll("button")]
    .find((item) => item.querySelector(".sr-only")?.textContent === label);

  try {
    for (const load of [0, 1]) {
      const client = new QueryClient();
      const root = createRoot(host);
      try {
        await act(async () => {
          root.render(<QueryClientProvider client={client}><MemoryRouter>
            <ConsultationRecordButton id="test" status="completed" />
          </MemoryRouter></QueryClientProvider>);
        });
        await act(async () => { button("Consultation record")!.click(); });
        const loaded = load === 0 ? "Confirm record" : "Download proof PDF";
        await vi.waitFor(async () => { await act(async () => {}); expect(button(loaded)).toBeDefined(); });
        if (load === 0) {
          expect(button("Request correction")).toBeDefined();
          await act(async () => { button("Confirm record")!.click(); });
          await vi.waitFor(async () => {
            await act(async () => {});
            expect(button("Download full record PDF")).toBeDefined();
          });
          expect(api.patch).toHaveBeenCalledWith("/api/consultations/test/record", { action: "confirm", revision: 2 });
        } else {
          expect(host.textContent).toContain("28 min");
          expect(host.textContent).not.toContain(details.summary);
          expect(button("Download full record PDF")).toBeUndefined();
          expect(button("Confirm record")).toBeUndefined();
        }
      } finally {
        await act(async () => root.unmount());
        client.clear();
      }
    }
    expect(api.get).toHaveBeenCalledTimes(2);
  } finally {
    host.remove();
    vi.unstubAllGlobals();
  }
});
