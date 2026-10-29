import crypto from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { generateToken, type AuthenticatedUser } from "../middleware/auth.js";
import { getPermissionsForRoles } from "@research-management/auth";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";
import {
  previewUserDeletion,
  permanentlyDeleteUser,
} from "./user-deletion.service.js";
import { processFileDeletionJobs } from "./file-deletion.service.js";
import { googleDriveService } from "./google-drive.service.js";
import { localStorageService } from "./local-storage.service.js";
import { supabaseStorageService } from "./supabase-storage.service.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe("Permanent account deletion with isolated PostgreSQL", () => {
  const marker = `user-delete-${crypto.randomUUID().slice(0, 8)}`;
  const fixture = createIntegrationFixtureScope(marker);
  const privateFile = `${marker}-private`,
    sharedFile = `${marker}-shared`;
  const storageFixturePaths: string[] = [];
  let admin: AuthenticatedUser,
    target: AuthenticatedUser,
    other: AuthenticatedUser;
  let ownedProjectId: string, otherProjectId: string, workspaceId: string;
  let server: http.Server, baseUrl: string;

  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    const college = await prisma.college.create({
      data: { code: marker, name: marker },
    });
    fixture.collegeIds.push(college.id);
    const program = await prisma.program.create({
      data: { collegeId: college.id, code: marker, name: marker },
    });
    fixture.programIds.push(program.id);
    const year = await prisma.academicYear.create({
      data: {
        name: marker,
        startDate: new Date("2098-01-01"),
        endDate: new Date("2099-01-01"),
      },
    });
    fixture.academicYearIds.push(year.id);
    const type = await prisma.researchType.create({
      data: { programId: program.id, code: marker, name: marker },
    });
    fixture.researchTypeIds.push(type.id);
    async function account(
      label: string,
      roleName: "SYSTEM_ADMIN" | "RESEARCHER",
    ) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
      const row = await prisma.user.create({
        data: {
          universityId: `${marker}-${label}`,
          email: `${marker}-${label}@isolated.test`,
          firstName: label,
          lastName: "DeletionFixture",
          passwordHash: "not-a-login-password",
          status: "ACTIVE",
          collegeId: college.id,
          programId: program.id,
          roles: { create: { roleId: role.id } },
        },
      });
      fixture.userIds.push(row.id);
      return {
        id: row.id,
        email: row.email,
        universityId: row.universityId,
        roles: [roleName],
        permissions: getPermissionsForRoles([roleName]),
        collegeId: college.id,
        programId: program.id,
      } as AuthenticatedUser;
    }
    admin = await account("admin", "SYSTEM_ADMIN");
    target = await account("target", "RESEARCHER");
    other = await account("other", "RESEARCHER");
    await prisma.facultyProfile.create({
      data: {
        userId: target.id,
        biography: "A restrictive profile must also be deleted.",
      },
    });
    const workspace = await prisma.researchWorkspace.create({
      data: {
        name: marker,
        collegeId: college.id,
        programId: program.id,
        createdBy: target.id,
        participationMode: "GROUP",
        inviteCode: marker,
        members: {
          create: [
            { userId: target.id, role: "LEADER" },
            { userId: other.id, role: "MEMBER" },
          ],
        },
      },
    });
    workspaceId = workspace.id;
    async function project(owner: AuthenticatedUser, shared: boolean) {
      const row = await prisma.researchProject.create({
        data: {
          title: `${marker}-${owner.id}`,
          researchTypeId: type.id,
          programId: program.id,
          collegeId: college.id,
          academicYearId: year.id,
          createdBy: owner.id,
          ...(shared ? { workspaceId, participationMode: "GROUP" } : {}),
          members: {
            create: [
              { userId: owner.id, projectRole: "LEADER" },
              ...(shared
                ? [{ userId: other.id, projectRole: "MEMBER" as const }]
                : []),
            ],
          },
        },
      });
      fixture.projectIds.push(row.id);
      return row;
    }
    const owned = await project(target, true),
      retained = await project(other, false);
    ownedProjectId = owned.id;
    otherProjectId = retained.id;
    const doc = await prisma.document.create({
      data: {
        researchId: owned.id,
        title: marker,
        documentType: "MANUSCRIPT",
        createdBy: target.id,
        versions: {
          create: [privateFile, sharedFile].map((fileId, i) => ({
            versionNumber: i + 1,
            fileName: `${i}.pdf`,
            mimeType: "application/pdf",
            fileSize: 1n,
            storagePath: `google-drive://${fileId}`,
            googleDriveFileId: fileId,
            uploadedBy: i ? other.id : target.id,
            submittedBy: target.id,
          })),
        },
      },
      include: { versions: true },
    });
    await prisma.officialCopy.create({
      data: {
        researchId: owned.id,
        documentId: doc.id,
        sourceVersionId: doc.versions[0].id,
        title: marker,
        documentType: "MANUSCRIPT",
        fileName: "official.pdf",
        fileSize: 1n,
        storagePath: `google-drive://${privateFile}`,
        googleDriveFileId: privateFile,
        checksum: "fixture",
        verificationCode: marker,
        finalizedById: other.id,
      },
    });
    await prisma.document.create({
      data: {
        researchId: retained.id,
        title: "Retained shared bytes",
        documentType: "MANUSCRIPT",
        createdBy: other.id,
        versions: {
          create: {
            versionNumber: 1,
            fileName: "retained.pdf",
            mimeType: "application/pdf",
            fileSize: 1n,
            storagePath: `google-drive://${sharedFile}`,
            googleDriveFileId: sharedFile,
            uploadedBy: other.id,
          },
        },
      },
    });
    // A raw UUID owner field and a legacy email author must also be found.
    await prisma.consultation.create({
      data: {
        researchId: retained.id,
        createdBy: target.id,
        title: marker,
        scheduledStart: new Date("2098-01-01"),
        scheduledEnd: new Date("2098-01-02"),
      },
    });
    const chat = await prisma.chatGroup.create({
      data: {
        title: marker,
        createdByAdviserId: other.email,
        adviserName: "Other",
        createdByUserId: other.id,
      },
    });
    await prisma.chatMessage.create({
      data: {
        chatGroupId: chat.id,
        senderId: target.email,
        senderName: "Deleted person",
        senderRole: "Student",
        message: marker,
      },
    });
    await prisma.chatParticipant.create({
      data: {
        chatGroupId: chat.id,
        userId: other.id,
        invitedByUserId: target.id,
        roleSnapshot: "RESEARCHER",
        status: "ACCEPTED",
      },
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }, 60_000);

  function request(
    path: string,
    actor = admin,
    method = "GET",
    body?: unknown,
    sessionVersion = 0,
  ) {
    return fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${generateToken(actor.id, sessionVersion)}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  const deletion = async (actor = admin) => ({
    actor,
    userId: target.id,
    confirmation: `delete ${target.universityId} sudo`,
    deleteAllData: true,
    previewToken: (await previewUserDeletion(admin, target.id)).token,
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (!fixture.databaseVerified) return;
    // These are explicitly scoped fixtures in the verified disposable test database.
    for (const account of [target, other].filter(Boolean)) {
      if (await prisma.user.findUnique({ where: { id: account.id } })) {
        const preview = await previewUserDeletion(admin, account.id);
        await permanentlyDeleteUser({
          actor: admin,
          userId: account.id,
          confirmation: `delete ${account.universityId} sudo`,
          previewToken: preview.token,
          deleteAllData: true,
        });
      }
    }
    await prisma.fileDeletionJob.deleteMany({
      where: {
        OR: [
          { fileId: { in: [privateFile, sharedFile] } },
          { storagePath: { in: storageFixturePaths } },
        ],
      },
    });
    await cleanupIntegrationFixture(prisma, fixture);
  }, 60_000);

  it("requires administrator access for impact previews and deletion", async () => {
    expect(
      (await request(`/users/${target.id}/deletion-preview`, other)).status,
    ).toBe(403);
    expect(
      (await request(`/users/${target.id}`, other, "DELETE", {})).status,
    ).toBe(403);
    await expect(previewUserDeletion(other, target.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(previewUserDeletion(admin, admin.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("suspends through the API, revokes existing sessions, and requires verified restoration", async () => {
    const response = await request(
      `/users/${target.id}/status`,
      admin,
      "PATCH",
      {
        status: "SUSPENDED",
        verificationNote: "Suspended for isolated test verification.",
      },
    );
    expect(response.status).toBe(200);
    expect((await request("/auth/me", target)).status).toBe(401);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: target.id } }))
        .sessionVersion,
    ).toBe(1);
    expect(
      (await request(`/users/${target.id}/approve`, admin, "POST", {})).status,
    ).toBe(400);
    expect(
      (
        await request(`/users/${target.id}/approve`, admin, "POST", {
          verificationConfirmed: true,
          verificationNote:
            "Verified identity using test institutional record.",
        })
      ).status,
    ).toBe(200);
    expect((await request("/auth/me", target)).status).toBe(401);
    expect(
      (await request("/auth/me", target, "GET", undefined, 2)).status,
    ).toBe(200);
    expect(
      (
        await request(`/users/${admin.id}/status`, admin, "PATCH", {
          status: "SUSPENDED",
          verificationNote: "Attempted self suspension.",
        })
      ).status,
    ).toBe(409);
  });

  it("archives and restores while preserving linked records, file references, and shared work", async () => {
    const before = await previewUserDeletion(admin, target.id);
    const beforeUser = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    const beforeJobs = await prisma.fileDeletionJob.count();
    const response = await request(
      `/users/${target.id}/archive`,
      admin,
      "POST",
      { reason: "User has left the institution." },
    );
    expect(response.status).toBe(200);
    const archived = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(archived.status).toBe("INACTIVE");
    expect(archived.sessionVersion).toBe(beforeUser.sessionVersion + 1);
    expect(
      (
        await request(
          "/auth/me",
          target,
          "GET",
          undefined,
          beforeUser.sessionVersion,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          "/auth/me",
          target,
          "GET",
          undefined,
          archived.sessionVersion,
        )
      ).status,
    ).toBe(401);
    const after = await previewUserDeletion(admin, target.id);
    expect(after.records).toEqual(before.records);
    expect(after.files).toBe(before.files);
    expect(after.affectedOtherUsers).toBe(before.affectedOtherUsers);
    expect(await prisma.fileDeletionJob.count()).toBe(beforeJobs);
    expect(
      (await request(`/users/${target.id}/approve`, admin, "POST", {})).status,
    ).toBe(400);
    expect(
      (
        await request(`/users/${target.id}/approve`, admin, "POST", {
          verificationConfirmed: true,
          verificationNote: "Verified institutional identity for return.",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "/auth/me",
          target,
          "GET",
          undefined,
          beforeUser.sessionVersion,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          "/auth/me",
          target,
          "GET",
          undefined,
          archived.sessionVersion + 1,
        )
      ).status,
    ).toBe(200);
    expect((await previewUserDeletion(admin, target.id)).records).toEqual(
      before.records,
    );
  });

  it("previews restrictive archive records, legacy owner data, and shared impact without deleting", async () => {
    const response = await request(`/users/${target.id}/deletion-preview`);
    expect(response.status).toBe(200);
    const { preview } = await response.json();
    expect(preview.affectedOtherUsers).toBe(1);
    expect(preview.files).toBe(2);
    expect(preview.records).toEqual(
      expect.arrayContaining([
        { type: "OfficialCopy", count: 1 },
        { type: "FacultyProfile", count: 1 },
        { type: "ChatMessage", count: 1 },
        { type: "Consultation", count: 1 },
      ]),
    );
    expect(await prisma.user.count({ where: { id: target.id } })).toBe(1);
  });

  it("rejects stale previews and missing all-data confirmation without partial deletion", async () => {
    const options = await deletion();
    await prisma.facultyProfile.update({
      where: { userId: target.id },
      data: { biography: "Changed after preview" },
    });
    await expect(permanentlyDeleteUser(options)).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(
      permanentlyDeleteUser({ ...(await deletion()), deleteAllData: false }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      permanentlyDeleteUser({
        ...(await deletion()),
        confirmation: "wrong phrase",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(
      await prisma.researchProject.count({ where: { id: ownedProjectId } }),
    ).toBe(1);
    expect(
      await prisma.fileDeletionJob.count({ where: { fileId: privateFile } }),
    ).toBe(0);
  });

  it("rolls back records and file jobs if the final audit write fails", async () => {
    // Inject a nonexistent audit actor to force a real FK failure at the end of the transaction.
    await expect(
      permanentlyDeleteUser({
        ...(await deletion()),
        actor: { ...admin, id: crypto.randomUUID() },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    expect(await prisma.user.count({ where: { id: target.id } })).toBe(1);
    expect(
      await prisma.researchProject.count({ where: { id: ownedProjectId } }),
    ).toBe(1);
    expect(
      await prisma.officialCopy.count({
        where: { researchId: ownedProjectId },
      }),
    ).toBe(1);
    expect(
      await prisma.fileDeletionJob.count({ where: { fileId: privateFile } }),
    ).toBe(0);
  });

  it("deletes local and Supabase uploads, removes empty documents, and repairs surviving current versions", async () => {
    const uploader = await prisma.user.create({
      data: {
        universityId: `${marker}-storage`,
        email: `${marker}-storage@isolated.test`,
        firstName: "Storage",
        lastName: "Fixture",
        passwordHash: "not-a-login-password",
        status: "ACTIVE",
      },
    });
    fixture.userIds.push(uploader.id);
    const previousProvider = process.env.STORAGE_PROVIDER;
    let local: Awaited<ReturnType<typeof localStorageService.uploadFile>>;
    try {
      process.env.STORAGE_PROVIDER = "LOCAL";
      local = await localStorageService.uploadFile({
        fileName: "fixture.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("fixture"),
        folder: marker,
      });
    } finally {
      if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
      else process.env.STORAGE_PROVIDER = previousProvider;
    }
    const supabasePath = `supabase://manuscripts/${marker}/${crypto.randomUUID()}-fixture.pdf`;
    storageFixturePaths.push(local!.storagePath, supabasePath);
    const versionData = (
      versionNumber: number,
      storagePath: string,
      uploadedBy: string,
    ) => ({
      versionNumber,
      storagePath,
      uploadedBy,
      fileName: "fixture.pdf",
      mimeType: "application/pdf",
      fileSize: 7n,
    });
    const survivingDocument = await prisma.document.create({
      data: {
        researchId: otherProjectId,
        createdBy: other.id,
        title: "Shared manuscript",
        documentType: "MANUSCRIPT",
        currentVersion: 3,
        versions: {
          create: [
            versionData(1, `google-drive://${sharedFile}`, other.id),
            versionData(2, local!.storagePath, uploader.id),
            versionData(3, supabasePath, uploader.id),
          ],
        },
      },
    });
    const emptyDocument = await prisma.document.create({
      data: {
        researchId: otherProjectId,
        createdBy: other.id,
        title: "Empty after deletion",
        documentType: "MANUSCRIPT",
        versions: { create: versionData(1, local!.storagePath, uploader.id) },
      },
    });
    try {
      const preview = await previewUserDeletion(admin, uploader.id);
      expect(preview.files).toBe(2);
      expect(preview.records).toContainEqual({ type: "Document", count: 1 });
      await permanentlyDeleteUser({
        actor: admin,
        userId: uploader.id,
        confirmation: `delete ${uploader.universityId} sudo`,
        previewToken: preview.token,
        deleteAllData: true,
      });
      expect(
        await prisma.document.findUnique({ where: { id: emptyDocument.id } }),
      ).toBeNull();
      expect(
        await prisma.document.findUnique({
          where: { id: survivingDocument.id },
        }),
      ).toMatchObject({ currentVersion: 1 });
      const remove = vi
        .spyOn(supabaseStorageService, "deleteStoredFile")
        .mockResolvedValue(true);
      try {
        await processFileDeletionJobs();
        expect(remove).toHaveBeenCalledWith(supabasePath);
        await expect(
          localStorageService.readStoredFile(local!.storagePath),
        ).rejects.toMatchObject({ code: "ENOENT" });
        expect(
          await prisma.fileDeletionJob.count({
            where: { storagePath: { in: storageFixturePaths } },
          }),
        ).toBe(0);
      } finally {
        remove.mockRestore();
      }
    } finally {
      await localStorageService.deleteStoredFile(local!.storagePath);
    }
  });

  it("blocks legacy API deletion; internal deletion still preserves unrelated work", async () => {
    const options = await deletion();
    const response = await request(
      `/users/${target.id}`,
      admin,
      "DELETE",
      options,
    );
    expect(response.status).toBe(410);
    expect(await prisma.user.count({ where: { id: target.id } })).toBe(1);
    expect((await permanentlyDeleteUser(options)).fileCleanupQueued).toBe(2);
    expect(await prisma.user.count({ where: { id: target.id } })).toBe(0);
    expect(
      await prisma.facultyProfile.count({ where: { userId: target.id } }),
    ).toBe(0);
    expect(
      await prisma.researchProject.count({ where: { id: ownedProjectId } }),
    ).toBe(0);
    expect(
      await prisma.researchWorkspace.count({ where: { id: workspaceId } }),
    ).toBe(0);
    expect(
      await prisma.officialCopy.count({
        where: { researchId: ownedProjectId },
      }),
    ).toBe(0);
    expect(
      await prisma.consultation.count({ where: { createdBy: target.id } }),
    ).toBe(0);
    expect(
      await prisma.chatMessage.count({ where: { senderId: target.email } }),
    ).toBe(0);
    expect(
      await prisma.chatParticipant.count({ where: { userId: other.id } }),
    ).toBe(1);
    expect(await prisma.user.count({ where: { id: other.id } })).toBe(1);
    expect(
      await prisma.researchProject.count({ where: { id: otherProjectId } }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { entityId: target.id, userId: admin.id, action: "DELETE" },
      }),
    ).toBe(1);
  });

  it("retries failed file cleanup and never deletes bytes still used by another project", async () => {
    const remove = vi
      .spyOn(googleDriveService, "deleteStoredFile")
      .mockResolvedValue(false);
    await processFileDeletionJobs();
    expect(remove).toHaveBeenCalledWith(privateFile);
    expect(remove).not.toHaveBeenCalledWith(sharedFile);
    expect(
      await prisma.fileDeletionJob.count({ where: { fileId: sharedFile } }),
    ).toBe(0);
    expect(
      await prisma.fileDeletionJob.findUnique({
        where: { fileId: privateFile },
      }),
    ).toMatchObject({ attempts: 1 });
    await prisma.fileDeletionJob.update({
      where: { fileId: privateFile },
      data: { nextAttemptAt: new Date(0) },
    });
    remove.mockResolvedValue(true);
    await processFileDeletionJobs();
    expect(
      await prisma.fileDeletionJob.count({ where: { fileId: privateFile } }),
    ).toBe(0);
    expect(await prisma.user.count({ where: { id: target.id } })).toBe(0);
  });
});
