import crypto from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { prisma } from "../lib/prisma.js";
import { googleDriveService } from "./google-drive.service.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe("milestone folder name concurrency", () => {
  const marker = `milestone-folders-${crypto.randomUUID().slice(0, 8)}`;
  const code = `MF${crypto.randomUUID().slice(0, 8)}`;
  const fixture = createIntegrationFixtureScope(marker);
  const folderIds: string[] = [];
  const rename = vi.fn();
  let stageId: string;
  let folder: {
    id: string;
    externalFolderId: string;
    pathKey: string;
    parentFolderId: string | null;
  };

  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    const college = await prisma.college.create({
      data: { code, name: marker },
    });
    fixture.collegeIds.push(college.id);
    const program = await prisma.program.create({
      data: { collegeId: college.id, code, name: marker },
    });
    fixture.programIds.push(program.id);
    const user = await prisma.user.create({
      data: {
        universityId: marker,
        email: `${marker}@isolated.test`,
        firstName: "Storage",
        lastName: "Fixture",
        collegeId: college.id,
        programId: program.id,
      },
    });
    fixture.userIds.push(user.id);
    const type = await prisma.researchType.create({
      data: { programId: program.id, code: marker, name: marker },
    });
    fixture.researchTypeIds.push(type.id);
    const workflow = await prisma.workflow.create({
      data: { researchTypeId: type.id, name: marker, createdBy: user.id },
    });
    fixture.workflowIds.push(workflow.id);
    const role = await prisma.role.upsert({
      where: { name: "RESEARCH_COORDINATOR" },
      create: { name: "RESEARCH_COORDINATOR" },
      update: {},
    });
    const stage = await prisma.workflowStage.create({
      data: {
        workflowId: workflow.id,
        name: "Topic Proposal",
        sequence: 1,
        responsibleRoleId: role.id,
      },
    });
    stageId = stage.id;
  });
  beforeEach(async () => {
    await prisma.workflowStage.update({
      where: { id: stageId },
      data: { name: "Topic Proposal", sequence: 1 },
    });
    const externalFolderId = `${marker}-${crypto.randomUUID()}`;
    folder = await prisma.storageFolder.create({
      data: {
        provider: "GOOGLE_DRIVE",
        pathKey: `${marker}/${externalFolderId}/stage:${stageId}`,
        externalFolderId,
        parentFolderId: "unchanged-parent",
        entityType: "WORKFLOW_STAGE",
        entityId: stageId,
        name: "01-Topic-Proposal",
      },
      select: {
        id: true,
        externalFolderId: true,
        pathKey: true,
        parentFolderId: true,
      },
    });
    folderIds.push(folder.id);
    rename
      .mockReset()
      .mockResolvedValue({ data: { id: folder.externalFolderId } });
    vi.spyOn(googleDriveService as any, "connectedClient").mockResolvedValue({
      drive: { files: { update: rename } },
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (fixture.databaseVerified)
      await prisma.storageFolder.deleteMany({
        where: { id: { in: folderIds } },
      });
    await cleanupIntegrationFixture(prisma, fixture);
  });

  it("preserves the same folder and parent after a milestone moves", async () => {
    await prisma.workflowStage.update({
      where: { id: stageId },
      data: { sequence: 7 },
    });
    await googleDriveService.synchronizeMilestoneFolderName(
      folder.externalFolderId,
      stageId,
    );
    const saved = await prisma.storageFolder.findUniqueOrThrow({
      where: { id: folder.id },
    });
    expect(saved).toMatchObject({ ...folder, name: "Topic-Proposal" });
    await googleDriveService.synchronizeMilestoneFolderName(
      folder.externalFolderId,
      stageId,
    );
    expect(rename).toHaveBeenCalledOnce();
  });

  it("retries a failed external rename without losing the persisted folder mapping", async () => {
    rename.mockRejectedValueOnce(new Error("Drive unavailable"));
    await expect(
      googleDriveService.synchronizeMilestoneFolderName(
        folder.externalFolderId,
        stageId,
      ),
    ).rejects.toThrow("Drive unavailable");
    expect(
      await prisma.storageFolder.findUnique({ where: { id: folder.id } }),
    ).toMatchObject({ ...folder, name: "01-Topic-Proposal" });
    await googleDriveService.synchronizeMilestoneFolderName(
      folder.externalFolderId,
      stageId,
    );
    expect(
      await prisma.storageFolder.findUnique({ where: { id: folder.id } }),
    ).toMatchObject({ ...folder, name: "Topic-Proposal" });
  });

  it("serializes overlapping renames so the latest milestone name wins", async () => {
    let entered!: () => void;
    let release!: () => void;
    const firstEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const releaseFirst = new Promise<void>((resolve) => {
      release = resolve;
    });
    rename.mockImplementationOnce(async () => {
      entered();
      await releaseFirst;
      return { data: { id: folder.externalFolderId } };
    });
    const first = googleDriveService.synchronizeMilestoneFolderName(
      folder.externalFolderId,
      stageId,
    );
    void first.catch(() => {});
    let second: Promise<boolean> | undefined;
    try {
      await Promise.race([
        firstEntered,
        first.then(() => {
          throw new Error("Rename did not reach Drive");
        }),
      ]);
      await prisma.workflowStage.update({
        where: { id: stageId },
        data: { name: "Final Defense" },
      });
      second = googleDriveService.synchronizeMilestoneFolderName(
        folder.externalFolderId,
        stageId,
      );
      release();
      await Promise.all([first, second]);
      expect(
        rename.mock.calls.map(([request]) => request.requestBody.name),
      ).toEqual(["Topic-Proposal", "Final-Defense"]);
      expect(
        await prisma.storageFolder.findUnique({ where: { id: folder.id } }),
      ).toMatchObject({ ...folder, name: "Final-Defense" });
    } finally {
      release();
      await Promise.allSettled([first, ...(second ? [second] : [])]);
    }
  }, 15_000);

  it("does not rename a mapped folder on behalf of a different milestone", async () => {
    expect(
      await googleDriveService.synchronizeMilestoneFolderName(
        folder.externalFolderId,
        crypto.randomUUID(),
      ),
    ).toBe(false);
    expect(rename).not.toHaveBeenCalled();
    expect(
      await prisma.storageFolder.findUnique({ where: { id: folder.id } }),
    ).toMatchObject({ ...folder, name: "01-Topic-Proposal" });
  });
});
