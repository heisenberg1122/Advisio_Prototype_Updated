import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ query: {} as any, get: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    state.query.options = options;
    return state.query;
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({ apiClient: { get: state.get } }));
vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ children, subtitle }: any) => (
    <section>{subtitle}{children}</section>
  ),
}));
import { TitleProposalReviewModal } from "./TitleProposalReviewModal";

const target = {
  stageId: "stage-a",
  researchId: "group-a",
  groupName: "Team Cohorts",
};
const proposal = {
  id: "proposal",
  version: 2,
  titles: ["First proposed title", "Second proposed title"],
  status: "SUBMITTED",
  selectedIndex: null,
  reviewNote: null,
};
const render = () =>
  renderToStaticMarkup(
    <TitleProposalReviewModal target={target} onClose={() => {}} />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  state.query = {
    data: { submissions: [proposal] },
    isLoading: false,
    isError: false,
  };
});

describe("title proposal review modal", () => {
  it("loads only the clicked group's proposals for the selected milestone", async () => {
    render();
    await state.query.options.queryFn();
    expect(state.get).toHaveBeenCalledWith(
      "/api/workflows/stages/stage-a/title-proposals?researchId=group-a",
    );
  });
  it("presents one radio group and requires a choice before approval", () => {
    const html = render();
    expect(html).toContain("Team Cohorts");
    expect(html).toContain("First proposed title");
    expect(html).toContain("Second proposed title");
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html.match(/name="approved-proposal-title"/g)).toHaveLength(2);
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Approve selected title<\/button>/,
    );
  });
  it("keeps approved proposals read-only and identifies the registered title", () => {
    state.query.data.submissions = [
      { ...proposal, status: "APPROVED", selectedIndex: 1 },
    ];
    const html = render();
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toContain("Registered research title");
    expect(html).not.toContain("Approve selected title");
  });
  it("shows revision feedback without allowing an outdated proposal to be approved", () => {
    state.query.data.submissions = [
      {
        ...proposal,
        status: "REVISION_REQUIRED",
        reviewNote: "Please narrow the scope.",
      },
    ];
    const html = render();
    expect(html).toContain("Please narrow the scope.");
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).not.toContain("Approve selected title");
  });
  it("shows a failed request rather than treating it as an empty submission", () => {
    state.query = {
      isError: true,
      error: new Error("Unable to load proposals"),
      isLoading: false,
    };
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("Unable to load proposals");
    expect(html).not.toContain("has no title proposal submission");
  });
});
