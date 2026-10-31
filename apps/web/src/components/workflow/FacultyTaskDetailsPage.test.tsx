import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  taskId: "task-a",
  projectId: "project-a",
  query: {} as any,
  options: {} as any,
  get: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    harness.options = options;
    return harness.query;
  },
}));
vi.mock("@/lib/api-client", () => ({ apiClient: { get: harness.get } }));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ taskId: harness.taskId }),
  useLocation: () => ({ pathname: "/adviser/tasks/task-a" }),
  useSearchParams: () => [
    new URLSearchParams(
      harness.projectId ? { projectId: harness.projectId } : {},
    ),
  ],
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
import FacultyTaskDetailsPage from "./FacultyTaskDetailsPage";
const render = () => renderToStaticMarkup(<FacultyTaskDetailsPage />);

beforeEach(() => {
  vi.clearAllMocks();
  harness.taskId = "task-a";
  harness.projectId = "project-a";
  harness.query = {
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    data: {
      project: { title: "Research project", groupName: "Group A" },
      milestones: [
        {
          id: "stage-a",
          name: "Topic Proposal",
          tasks: [
            { id: "other-task", title: "Unrelated task", attempts: [] },
            {
              id: "task-a",
              title: "Selected deliverable",
              isRequired: true,
              status: "UNDER_REVIEW",
              documentId: "doc-a",
              documentVersionId: "version-a",
              attempts: [
                {
                  id: "attempt-a",
                  attemptNumber: 2,
                  status: "UNDER_REVIEW",
                  submittedAt: "2026-10-29T08:00:00Z",
                },
              ],
            },
          ],
        },
      ],
    },
  };
});

describe("faculty task details", () => {
  it("opens the selected task with its attempts and exact document version", () => {
    const html = render();
    expect(html).toContain("Selected deliverable");
    expect(html).toContain("Attempt 2");
    expect(html).not.toContain("Unrelated task");
    expect(html).toContain(
      "/adviser/documents?tab=workspace&amp;projectId=project-a&amp;documentId=doc-a&amp;versionId=version-a",
    );
    expect(html).not.toContain("/student/");
  });
  it("requests only the selected project's authorized read endpoints", async () => {
    render();
    harness.get
      .mockResolvedValueOnce({ project: {} })
      .mockResolvedValueOnce({ milestones: [] });
    await harness.options.queryFn();
    expect(harness.get.mock.calls.map((call) => call[0])).toEqual([
      "/api/research/project-a",
      "/api/research/project-a/manuscript-workflow",
    ]);
  });
  it("does not substitute a different task when the linked task is missing", () => {
    harness.taskId = "missing";
    const html = render();
    expect(html).toContain("Task not found");
    expect(html).not.toContain("Selected deliverable");
  });
  it("does not load another project when project context is missing", () => {
    harness.projectId = "";
    expect(render()).toContain("missing its project or task");
    expect(harness.options.enabled).toBe(false);
  });
  it("shows a loading state until task data is ready", () => {
    harness.query = { isPending: true };
    const html = render();
    expect(html).toContain("Loading task details");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-slot="skeleton"');
  });
  it("keeps access and network failures visible instead of redirecting to overview", () => {
    harness.query = { isError: true, refetch: vi.fn() };
    const html = render();
    expect(html).toContain("Task unavailable");
    expect(html).toContain("Try again");
  });
});
