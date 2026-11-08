// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
import PanelistDashboardPage from "../dashboard/page";
import PanelistReviewsPage from "./page";

const api = vi.hoisted(() => ({ get: vi.fn(), file: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: api }));
vi.mock("@/components/panelist/PdfEvaluationWorkspace", () => ({
  PdfEvaluationWorkspace: () => null,
}));
vi.mock("@/components/documents/PdfDocumentPreview", () => ({
  PdfDocumentPreview: () => null,
}));
vi.mock("@/components/documents/ManuscriptReviewWorkspace", () => ({
  ManuscriptReviewWorkspace: ({ navigation }: { navigation: React.ReactNode }) => (
    <>{navigation}<h2>Assignment queue</h2></>
  ),
}));

function CurrentUrl() {
  const { pathname, search } = useLocation();
  return <output>{pathname}{search}</output>;
}

it("opens the selected completed defense from an old bookmark and retains shared feedback", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const version = { id: "v2", fileName: "manuscript.pdf", versionNumber: 2 };
  const earlier = { id: "v1", fileName: "original.pdf", versionNumber: 1 };
  client.setQueryData(["defense-review-packets"], {
    sessions: [
      { id: "pending", research: { title: "Pending defense" } },
      { id: "completed", research: { title: "Completed defense" }, manuscriptReviews: [{ reviewedAt: "2026-11-06" }] },
    ],
  });
  client.setQueryData(["defense-review-packet", "completed"], {
    packet: { manuscriptVersion: version },
  });
  client.setQueryData(["manuscript-review-versions", "completed"], {
    currentVersion: version, reviewedVersions: [earlier],
  });
  client.setQueryData(["shared-manuscript-feedback", "completed"], {
    publications: [{
      id: "feedback",
      revision: 1,
      publishedAt: "2026-11-06T00:00:00Z",
      review: { panelist: { firstName: "Marisol", lastName: "Cruz" }, sourceVersion: earlier },
    }],
  });

  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const createObjectURL = vi.fn(() => "blob:shared-feedback");
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {
    createObjectURL, revokeObjectURL: vi.fn(),
  }));
  api.file.mockResolvedValue(new Blob());
  const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const button = (label: string) =>
    Array.from(host.querySelectorAll("button")).find((node) => node.textContent === label)!;
  try {
    await act(async () => root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/panelist/dashboard?tab=documents&sessionId=completed&review=history"]}>
          <CurrentUrl />
          <Routes>
            <Route path="/panelist/dashboard" element={<PanelistDashboardPage />} />
            <Route path="/panelist/reviews" element={<PanelistReviewsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ));

    expect(host.querySelector("output")?.textContent)
      .toBe("/panelist/reviews?tab=defense-packets&sessionId=completed&review=history");
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Manuscript review version"]')?.value).toBe("v2");
    expect(host.textContent).toContain("Completed defense");
    expect(host.textContent).not.toContain("Pending defense");
    expect(host.textContent).toContain("Earlier manuscript version");

    await act(async () => button("Preview feedback").click());
    expect(api.file).toHaveBeenCalledWith("/api/defense-sessions/completed/manuscript-feedback/feedback/content");
    expect(host.querySelector('[aria-label="Shared manuscript feedback preview"]')).not.toBeNull();
    await act(async () => button("Download feedback").click());
    expect(api.file).toHaveBeenCalledWith("/api/defense-sessions/completed/manuscript-feedback/feedback/content?download=1");
    expect(download).toHaveBeenCalledTimes(1);

    await act(async () => host.querySelector<HTMLAnchorElement>('a[href="/panelist/reviews"]')!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    ));
    expect(host.textContent).toContain("Assignment queue");
    expect(host.textContent).not.toContain("Shared manuscript feedback");
  } finally {
    act(() => root.unmount());
    client.clear();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
