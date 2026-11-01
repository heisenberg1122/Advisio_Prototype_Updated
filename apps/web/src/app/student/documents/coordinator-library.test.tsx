import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  path: "/professor/documents",
  search: "?tab=workspace&projectId=project-1",
  states: [] as any[],
  index: 0,
  navigate: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: any) => {
    const index = harness.index++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [
      harness.states[index],
      (value: any) => {
        harness.states[index] =
          typeof value === "function" ? value(harness.states[index]) : value;
      },
    ];
  },
  useEffect: () => {},
  useMemo: (callback: any) => callback(),
  useRef: (value: any) => ({ current: value }),
}));
vi.mock("react-router-dom", () => ({
  Link: "a",
  useNavigate: () => harness.navigate,
  useLocation: () => ({ pathname: harness.path, search: harness.search }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => harness.path,
  useSearchParams: () => new URLSearchParams(harness.search),
}));
vi.mock("@/providers/active-project-provider", () => ({
  useActiveProject: () => ({
    projectId: "project-1",
    invalidRequestedProjectId: null,
    selectProject: vi.fn(),
  }),
}));
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("@/components/documents/ResearchFileManager", () => ({
  ResearchFileManager: () => null,
}));

import DocumentWorkspacePage from "./page";
import { ResearcherDocumentsWorkspace } from "./ResearcherDocumentsWorkspace";
import { ResearchFileManager } from "@/components/documents/ResearchFileManager";

const project = {
  id: "project-1",
  title: "Capstone",
  workflowInstance: { workflow: { name: "BSIT", stages: [] } },
};
const document = {
  id: "file-1",
  title: "Manuscript",
  lifecycleStatus: "IN_REVIEW",
  documentType: "MANUSCRIPT",
  updatedAt: "2026-10-28T00:00:00Z",
  versions: [
    {
      id: "v1",
      versionNumber: 1,
      fileName: "manuscript.pdf",
      mimeType: "application/pdf",
      webViewLink: "/api/documents/files/v1",
      uploadedAt: "2026-10-28T00:00:00Z",
      reviews: [],
    },
  ],
};
const permissions = {
  canView: true,
  canManageWorkingDocuments: false,
  canSubmitManuscript: false,
  canReview: true,
  canApproveOfficialDocuments: false,
};
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function render() {
  harness.index = 0;
  return nodes(DocumentWorkspacePage());
}
function library() {
  return render().find((node) => node.type === ResearcherDocumentsWorkspace);
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.path = "/professor/documents";
  harness.search = "?tab=workspace&projectId=project-1";
  harness.states = [
    [project],
    [document],
    [],
    [],
    permissions,
    "",
    false,
    false,
  ];
  vi.stubGlobal("document", {
    activeElement: { id: "researcher-file-file-1" },
  });
  vi.stubGlobal("window", { scrollX: 0, scrollY: 120 });
});
afterEach(() => vi.unstubAllGlobals());
describe("coordinator document library", () => {
  it("opens the full-width researcher library without automatically previewing the first file", () => {
    const tree = render();
    const workspace = tree.find(
      (node) => node.type === ResearcherDocumentsWorkspace,
    );
    expect(workspace?.props.selectedDocumentId).toBe("");
    expect(workspace?.props.documents).toEqual([document]);
    expect(tree.some((node) => node.type === ResearchFileManager)).toBe(false);
    expect(workspace.props.permissions).toEqual(permissions);
    expect(workspace.props.taskHref).toBeUndefined();
  });
  it("opens a clicked document in the coordinator portal and preserves project context", () => {
    library().props.onSelectDocument("file-1");
    const [url] = harness.navigate.mock.calls[0];
    const target = new URL(url, "http://localhost:3000");
    expect(target.pathname).toBe("/professor/documents");
    expect(target.searchParams.get("projectId")).toBe("project-1");
    expect(target.searchParams.get("documentId")).toBe("file-1");
    expect(target.searchParams.get("tab")).toBe("workspace");
  });
  it("opens exact-version deep links in the dedicated viewer with read-only coordinator capabilities", () => {
    harness.search += "&documentId=file-1&versionId=v1";
    harness.states[5] = "file-1";
    const workspace = library();
    expect(workspace.props.selectedDocumentId).toBe("file-1");
    expect(workspace.props.requestedVersionId).toBe("v1");
    expect(workspace.props.permissions.canManageWorkingDocuments).toBe(false);
    expect(workspace.props.permissions.canSubmitManuscript).toBe(false);
    workspace.props.onBack();
    const target = new URL(
      harness.navigate.mock.calls[0][0],
      "http://localhost:3000",
    );
    expect(target.pathname).toBe("/professor/documents");
    expect(target.searchParams.get("documentId")).toBeNull();
    expect(target.searchParams.get("versionId")).toBeNull();
    expect(target.searchParams.get("projectId")).toBe("project-1");
  });
  it("does not substitute the first file when a deep link points to an unavailable document", () => {
    harness.search += "&documentId=unavailable";
    expect(library().props.selectedDocumentId).toBe("");
  });
});
