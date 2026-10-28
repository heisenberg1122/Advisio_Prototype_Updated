import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercise modal callbacks without requiring a browser DOM.
const harness = vi.hoisted(() => ({
  states: [] as any[],
  refs: [] as any[],
  stateIndex: 0,
  refIndex: 0,
  roles: ["ADVISER"],
  get: vi.fn(),
  post: vi.fn(),
  run: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: any) => {
    const index = harness.stateIndex++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [
      harness.states[index],
      (value: any) => {
        harness.states[index] = value;
      },
    ];
  },
  useRef: (initial: any) => {
    const index = harness.refIndex++;
    return (harness.refs[index] ??= { current: initial });
  },
  useEffect: () => {},
  useCallback: (callback: any) => callback,
  useMemo: (callback: any) => callback(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { roles: harness.roles } }),
}));
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: harness.get, post: harness.post },
}));
vi.mock("@/hooks/use-async-action", () => ({
  useAsyncAction: () => ({
    reset: vi.fn(),
    run: harness.run,
    status: "idle",
    isPending: false,
  }),
}));
import { ManuscriptReviewWorkspace } from "./ManuscriptReviewWorkspace";

function render() {
  harness.stateIndex = 0;
  harness.refIndex = 0;
  return ManuscriptReviewWorkspace({ presentation: "adviser" });
}
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.footer)];
}
function button(tree: any, label: string) {
  return nodes(tree).find(
    (node) => node.props?.onClick && node.props.children === label,
  );
}
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const workflow = {
  document: {
    versions: [{ id: "v1", versionNumber: 1, reviewerAssignments: [] }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  harness.roles = ["ADVISER"];
  harness.refs = [];
  harness.states = [
    [
      {
        id: "a1",
        status: "ACTIVE",
        reviewType: "ADVISER",
        isRequired: true,
        assignedAt: "2026-10-28T00:00:00Z",
        document: { id: "d1", title: "Defense", lifecycleStatus: "IN_REVIEW" },
        documentVersion: {
          id: "v1",
          versionNumber: 1,
          fileName: "manuscript.pdf",
        },
        research: { id: "r1", title: "Research" },
      },
    ],
    false,
  ];
  harness.run.mockImplementation(async (action) => action());
  harness.post.mockResolvedValue({});
  harness.get.mockResolvedValue(workflow);
});

describe("manuscript review context failures", () => {
  it("keeps history failure separate from submission and supports retry", async () => {
    harness.get.mockRejectedValueOnce(
      new Error("Unable to process the manuscript review."),
    );
    button(render(), "Review and decide").props.onClick();
    await settle();
    let tree = render();
    expect(
      nodes(tree).some(
        (node) =>
          node.props?.tone === "warning" &&
          node.props?.message?.includes("You can still submit"),
      ),
    ).toBe(true);
    expect(
      nodes(tree).some(
        (node) =>
          node.props?.message === "Unable to process the manuscript review.",
      ),
    ).toBe(false);
    expect(
      nodes(tree).some(
        (node) =>
          node.props?.children ===
          "No earlier faculty decisions are recorded for this manuscript.",
      ),
    ).toBe(false);

    await button(tree, "Retry review history").props.onClick();
    await settle();
    tree = render();
    expect(button(tree, "Retry review history")).toBeUndefined();
    expect(
      nodes(tree).some(
        (node) =>
          node.props?.children ===
          "No earlier faculty decisions are recorded for this manuscript.",
      ),
    ).toBe(true);
  });

  it("allows a decision after history fails and only posts once", async () => {
    harness.get.mockRejectedValueOnce(new Error("History unavailable"));
    button(render(), "Review and decide").props.onClick();
    await settle();
    harness.get.mockResolvedValue({ assignments: [] });
    button(render(), "Submit permanent decision").props.onClick();
    await settle();
    expect(harness.post).toHaveBeenCalledExactlyOnceWith(
      "/api/reviewer-assignments/a1/decision",
      {
        recommendation: "APPROVE",
        overallComment: null,
        comments: [],
      },
    );
    expect(
      nodes(render()).find(
        (node) => node.props?.title === "Submit manuscript decision",
      ).props.isOpen,
    ).toBe(false);
  });

  it("retains history when the coordinator's candidate request fails", async () => {
    harness.roles = ["ADVISER", "RESEARCH_COORDINATOR"];
    harness.get.mockImplementation((url: string) =>
      url.endsWith("reviewer-candidates")
        ? Promise.reject(new Error("Candidates unavailable"))
        : Promise.resolve(workflow),
    );
    button(render(), "Review and decide").props.onClick();
    await settle();
    const tree = render();
    expect(button(tree, "Retry review history")).toBeUndefined();
    expect(button(tree, "Retry eligible reviewers")).toBeDefined();
    expect(
      nodes(tree).some(
        (node) =>
          node.props?.children ===
          "No earlier faculty decisions are recorded for this manuscript.",
      ),
    ).toBe(true);
  });
});
