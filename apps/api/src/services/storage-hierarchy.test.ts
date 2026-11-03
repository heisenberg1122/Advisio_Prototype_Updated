import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  project: vi.fn(),
  folders: vi.fn(),
  ensure: vi.fn(),
  rename: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    researchProject: { findUnique: mocks.project },
    storageFolder: { findMany: mocks.folders },
  },
}));
vi.mock("./google-drive.service.js", () => ({
  googleDriveService: {
    ensureFolderPath: mocks.ensure,
    synchronizeMilestoneFolderName: mocks.rename,
  },
}));
import { storageHierarchyService } from "./storage-hierarchy.service.js";

const project = () => ({
  id: "project",
  academicYearId: "year",
  academicYear: { name: "2026" },
  collegeId: "college",
  college: { code: "CIT", name: "Computing" },
  programId: "program",
  program: { code: "BSIT", name: "Information Technology" },
  title: "Sample research",
  groupName: "Team A",
  workflowInstance: {
    workflowId: "workflow",
    currentStage: { id: "stage", name: "Topic Proposal", sequence: 2 },
    workflow: {
      stages: [{ id: "stage", name: "Topic Proposal", sequence: 2 }],
    },
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.project.mockResolvedValue(project());
  mocks.ensure.mockResolvedValue("existing-folder");
  mocks.folders.mockResolvedValue([]);
  mocks.rename.mockResolvedValue(true);
});

describe("position-independent milestone storage", () => {
  it("does not try to rename a synthetic general-documents milestone", async () => {
    mocks.project.mockResolvedValue({ ...project(), workflowInstance: null });
    await storageHierarchyService.provisionProject("project");
    const stage = mocks.ensure.mock.calls[0][0].find(
      (item: any) => item.entityType === "WORKFLOW_STAGE",
    );
    expect(stage).toMatchObject({
      name: "General-Documents",
      syncMilestoneName: false,
    });
  });

  it("creates milestone folders without an order prefix, retaining the ID-based path", async () => {
    await storageHierarchyService.provisionProject("project");
    expect(mocks.ensure).toHaveBeenCalledTimes(4);
    for (const [segments] of mocks.ensure.mock.calls) {
      expect(
        segments.find((item: any) => item.entityType === "WORKFLOW_STAGE"),
      ).toEqual({
        key: "stage:stage",
        name: "Topic-Proposal",
        entityType: "WORKFLOW_STAGE",
        entityId: "stage",
        syncMilestoneName: true,
      });
    }
  });

  it("resolves the same folder path before and after reordering", async () => {
    await storageHierarchyService.resolveFolder({
      researchId: "project",
      stageId: "stage",
      bucket: "SUBMISSIONS",
    });
    const before = mocks.ensure.mock.calls[0][0];
    const moved = project();
    moved.workflowInstance.workflow.stages[0].sequence = 7;
    mocks.project.mockResolvedValue(moved);
    expect(
      await storageHierarchyService.resolveFolder({
        researchId: "project",
        stageId: "stage",
        bucket: "SUBMISSIONS",
      }),
    ).toBe("existing-folder");
    expect(mocks.ensure.mock.calls[1][0]).toEqual(before);
  });

  it("keeps same-name milestones separate by permanent ID", async () => {
    const value = project();
    value.workflowInstance.workflow.stages.push({
      id: "other-stage",
      name: "Topic Proposal",
      sequence: 3,
    });
    mocks.project.mockResolvedValue(value);
    await storageHierarchyService.resolveFolder({
      researchId: "project",
      stageId: "other-stage",
      bucket: "SUBMISSIONS",
    });
    expect(
      mocks.ensure.mock.calls[0][0].find(
        (item: any) => item.entityType === "WORKFLOW_STAGE",
      ).key,
    ).toBe("stage:other-stage");
  });

  it("renames only existing mapped folders and reports failures without creating replacements", async () => {
    mocks.folders.mockResolvedValue([
      { externalFolderId: "one" },
      { externalFolderId: "two" },
    ]);
    mocks.rename
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("Drive offline"));
    expect(
      await storageHierarchyService.synchronizeStageFolderNames("stage"),
    ).toEqual({ folders: 2, failedFolders: 1 });
    expect(mocks.folders).toHaveBeenCalledWith({
      where: {
        provider: "GOOGLE_DRIVE",
        entityType: "WORKFLOW_STAGE",
        entityId: "stage",
      },
      select: { externalFolderId: true },
    });
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
});
