import { afterEach, describe, expect, it, vi } from "vitest";
import { loadResearcherCohorts } from "./use-researcher-lifecycle";
afterEach(() => vi.unstubAllGlobals());
describe("authorized cohort loading", () => {
  it("loads all pages so an eligible cohort is never silently omitted", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cohorts: [{ id: "first", status: "ARCHIVED" }],
            pagination: { totalPages: 2 },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cohorts: [{ id: "active", status: "ACTIVE" }],
            pagination: { totalPages: 2 },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await loadResearcherCohorts()).toMatchObject({
      cohorts: [{ id: "first" }, { id: "active" }],
    });
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      "/api/cohorts?page=1&limit=100",
      "/api/cohorts?page=2&limit=100",
    ]);
  });
});
