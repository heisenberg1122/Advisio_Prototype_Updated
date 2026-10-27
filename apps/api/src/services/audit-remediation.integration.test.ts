import crypto from "node:crypto";
import http from "node:http";
import bcrypt from "bcryptjs";
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
import { resolveRegistrationWorkflow } from "./registration-workflow.service.js";
import { changeAccountStatus } from "./account-status.service.js";
import {
  recoveryTokenHash,
  resetPassword,
} from "./password-recovery.service.js";
import {
  removeResearcherMembership,
  transferResearchLeadership,
} from "./group-membership.service.js";
import { documentService } from "./document.service.js";
import { googleDriveService } from "./google-drive.service.js";
import { storageHierarchyService } from "./storage-hierarchy.service.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe("Audit remediation with isolated PostgreSQL", () => {
  const marker = `audit-security-${crypto.randomUUID().slice(0, 8)}`;
  const fixture = createIntegrationFixtureScope(marker);
  const cohortIds: string[] = [];
  let leader: AuthenticatedUser,
    member: AuthenticatedUser,
    professor: AuthenticatedUser,
    administrator: AuthenticatedUser;
  let collegeId: string,
    programId: string,
    projectId: string,
    workspaceId: string,
    documentId: string,
    selectedWorkflowId: string;
  let server: http.Server, baseUrl: string;

  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    const college = await prisma.college.create({
      data: {
        code: `AS-${marker.slice(-8)}`,
        name: `Audit Security ${marker}`,
      },
    });
    fixture.collegeIds.push(college.id);
    collegeId = college.id;
    const program = await prisma.program.create({
      data: {
        collegeId,
        code: `AS-${marker.slice(-8)}`,
        name: `Audit Security ${marker}`,
      },
    });
    fixture.programIds.push(program.id);
    programId = program.id;
    const year = await prisma.academicYear.create({
      data: {
        name: `AS-${marker.slice(-8)}`,
        startDate: new Date("2098-01-01"),
        endDate: new Date("2099-01-01"),
      },
    });
    fixture.academicYearIds.push(year.id);
    async function account(
      name: string,
      roleName: "RESEARCHER" | "RESEARCH_COORDINATOR" | "SYSTEM_ADMIN",
    ) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
      const row = await prisma.user.create({
        data: {
          universityId: `${marker}-${name}`,
          email: `${marker}-${name}@isolated.test`,
          firstName: name,
          lastName: "AuditFixture",
          status: "ACTIVE",
          collegeId,
          programId,
          passwordHash: await bcrypt.hash("InitialPassword123!", 4),
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
        collegeId,
        programId,
      } as AuthenticatedUser;
    }
    leader = await account("leader", "RESEARCHER");
    member = await account("member", "RESEARCHER");
    professor = await account("professor", "RESEARCH_COORDINATOR");
    administrator = await account("admin", "SYSTEM_ADMIN");
    const type = await prisma.researchType.create({
      data: { programId, code: `AS-${marker.slice(-8)}`, name: marker },
    });
    fixture.researchTypeIds.push(type.id);
    const coordinatorRole = await prisma.role.findUniqueOrThrow({
      where: { name: "RESEARCH_COORDINATOR" },
    });
    const workflows = [];
    for (let version = 1; version <= 2; version++) {
      const workflow = await prisma.workflow.create({
        data: {
          researchTypeId: type.id,
          name: marker,
          version,
          status: "PUBLISHED",
          createdBy: professor.id,
          stages: {
            create: {
              name: "Review",
              sequence: 1,
              responsibleRoleId: coordinatorRole.id,
            },
          },
        },
        include: { stages: true },
      });
      fixture.workflowIds.push(workflow.id);
      workflows.push(workflow);
    }
    await prisma.researchType.update({
      where: { id: type.id },
      data: { workflowId: workflows[0].id },
    });
    selectedWorkflowId = workflows[1].id;
    await prisma.workflowEnrollment.create({
      data: { workflowId: selectedWorkflowId, userId: leader.id },
    });
    const cohort = await prisma.researchCohort.create({
      data: {
        name: `${marker}-cohort`,
        collegeId,
        programId,
        researchTypeId: type.id,
        academicYearId: year.id,
        workflowId: selectedWorkflowId,
        status: "ACTIVE",
        createdBy: professor.id,
        members: { create: { userId: leader.id } },
      },
    });
    cohortIds.push(cohort.id);
    const workspace = await prisma.researchWorkspace.create({
      data: {
        name: marker,
        collegeId,
        programId,
        createdBy: leader.id,
        participationMode: "GROUP",
        inviteCode: marker.slice(-8),
        members: {
          create: [
            { userId: leader.id, role: "LEADER" },
            { userId: member.id, role: "MEMBER" },
          ],
        },
      },
    });
    workspaceId = workspace.id;
    const project = await prisma.researchProject.create({
      data: {
        title: marker,
        researchTypeId: type.id,
        collegeId,
        programId,
        academicYearId: year.id,
        createdBy: leader.id,
        workspaceId,
        participationMode: "GROUP",
        members: {
          create: [
            { userId: leader.id, projectRole: "LEADER" },
            { userId: member.id, projectRole: "MEMBER" },
          ],
        },
      },
    });
    fixture.projectIds.push(project.id);
    projectId = project.id;
    const instance = await prisma.workflowInstance.create({
      data: {
        researchId: projectId,
        workflowId: selectedWorkflowId,
        workflowVersion: 2,
        currentStageId: workflows[1].stages[0].id,
      },
    });
    await prisma.researchProject.update({
      where: { id: projectId },
      data: { workflowInstanceId: instance.id },
    });
    const doc = await prisma.document.create({
      data: {
        researchId: projectId,
        title: "Audit manuscript",
        documentType: "MANUSCRIPT",
        createdBy: leader.id,
        versions: {
          create: {
            versionNumber: 1,
            fileName: "original.pdf",
            mimeType: "application/pdf",
            fileSize: 10n,
            storagePath: "google-drive://audit-original",
            googleDriveFileId: "audit-original",
            uploadedBy: leader.id,
          },
        },
      },
    });
    documentId = doc.id;
    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  }, 30000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (fixture.databaseVerified) {
      await prisma.researchCohort.deleteMany({ where: { id: { in: cohortIds } } });
      // Workspaces are tracked separately because the shared fixture scope predates them.
      if (workspaceId) {
        await prisma.researchProject.updateMany({
          where: { id: { in: fixture.projectIds } },
          data: { workspaceId: null },
        });
        await prisma.researchWorkspace.delete({ where: { id: workspaceId } });
      }
      await cleanupIntegrationFixture(prisma, fixture);
    }
  }, 30000);

  it("returns document-bearing project details without BigInt serialization failures", async () => {
    const res = await fetch(`${baseUrl}/api/research/${projectId}`, {
      headers: { Authorization: `Bearer ${generateToken(leader.id)}` },
    });
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.project.documents[0].versions[0].fileSize).toBe(10);
  });

  it("keeps a personal availability entry private from an unrelated professor", async () => {
    const entry = await prisma.calendarEvent.create({
      data: {
        title: "Personal private leave",
        type: "AVAILABILITY",
        visibility: "PARTICIPANTS",
        collegeId,
        startsAt: new Date("2098-10-01"),
        endsAt: new Date("2098-10-02"),
        createdBy: administrator.id,
        participants: { create: { userId: administrator.id } },
      },
    });
    try {
      const res = await fetch(
        `${baseUrl}/api/calendar?start=2098-10-01&end=2098-10-03`,
        { headers: { Authorization: `Bearer ${generateToken(professor.id)}` } },
      );
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.events.some((event: any) => event.id === entry.id)).toBe(
        false,
      );
    } finally {
      await prisma.calendarEvent.delete({ where: { id: entry.id } });
    }
  });

  it("resolves the joined workflow rather than the research type default", async () => {
    expect(
      (await resolveRegistrationWorkflow(leader, programId)).workflow?.id,
    ).toBe(selectedWorkflowId);
  });

  it("prevents deactivation of the last active administrator under a transaction lock", async () => {
    await expect(
      changeAccountStatus({
        actor: administrator,
        userId: administrator.id,
        status: "INACTIVE",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: administrator.id } }))
        .status,
    ).toBe("ACTIVE");
  });

  it("allocates unique document version numbers for simultaneous uploads", async () => {
    vi.stubEnv("STORAGE_PROVIDER", "GOOGLE_DRIVE");
    const upload = vi
      .spyOn(googleDriveService, "uploadFile")
      .mockImplementation(async (options) => {
        const fileId = crypto.randomUUID();
        return {
          fileId,
          fileName: options.fileName,
          mimeType: options.mimeType,
          sizeBytes: options.buffer.length,
          webViewLink: `/api/documents/files/${fileId}`,
          webContentLink: "",
          storagePath: `google-drive://${fileId}`,
        };
      });
    const folders = vi
      .spyOn(storageHierarchyService, "resolveFolder")
      .mockResolvedValue("audit-mock-folder");
    const cleanup = vi
      .spyOn(googleDriveService, "deleteStoredFile")
      .mockResolvedValue(true);
    try {
      const results = await Promise.all(
        ["one", "two"].map((name) =>
          documentService.addDocumentVersion({
            documentId,
            fileName: `${name}.pdf`,
            mimeType: "application/pdf",
            fileBuffer: Buffer.from(`%PDF-${name}`),
            uploadedBy: leader.id,
          }),
        ),
      );
      expect(results.map((version) => version.versionNumber).sort()).toEqual([
        2, 3,
      ]);
      expect(
        await prisma.documentVersion.count({
          where: { documentId, status: "ACTIVE" },
        }),
      ).toBe(1);
      expect(
        (await prisma.document.findUniqueOrThrow({ where: { id: documentId } }))
          .currentVersion,
      ).toBe(3);
      expect(cleanup).not.toHaveBeenCalled();
    } finally {
      upload.mockRestore();
      folders.mockRestore();
      cleanup.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("transfers leadership back and forth without stale-role uniqueness conflicts", async () => {
    await transferResearchLeadership(projectId, leader.id, member.id);
    await transferResearchLeadership(projectId, member.id, leader.id);
    expect(
      await prisma.researchMember.count({
        where: { researchId: projectId, projectRole: "LEADER", leftAt: null },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.workspaceMember.findUniqueOrThrow({
          where: { workspaceId_userId: { workspaceId, userId: leader.id } },
        })
      ).role,
    ).toBe("LEADER");
  });

  it("revokes project access when a member is removed", async () => {
    const membership = await prisma.researchMember.findFirstOrThrow({
      where: {
        researchId: projectId,
        userId: member.id,
        projectRole: "MEMBER",
        leftAt: null,
      },
    });
    await removeResearcherMembership(projectId, leader.id, membership.id);
    const res = await fetch(`${baseUrl}/api/research/${projectId}`, {
      headers: { Authorization: `Bearer ${generateToken(member.id)}` },
    });
    expect(res.status).toBe(404);
    expect(
      (
        await prisma.workspaceMember.findUniqueOrThrow({
          where: { workspaceId_userId: { workspaceId, userId: member.id } },
        })
      ).leftAt,
    ).not.toBeNull();
  });

  it("consumes reset tokens once and rejects the prior authenticated session", async () => {
    const token = crypto.randomBytes(32).toString("hex");
    const oldSession = generateToken(leader.id, 0);
    await prisma.user.update({
      where: { id: leader.id },
      data: {
        passwordResetTokenHash: recoveryTokenHash(token),
        passwordResetExpiresAt: new Date(Date.now() + 60000),
      },
    });
    await resetPassword(token, "NewFixturePassword123!");
    await expect(
      resetPassword(token, "ReplayPassword123!"),
    ).rejects.toMatchObject({ statusCode: 400 });
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${oldSession}` },
    });
    expect(res.status).toBe(401);
    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: leader.id },
    });
    expect(updated.sessionVersion).toBe(1);
    expect(
      await bcrypt.compare("NewFixturePassword123!", updated.passwordHash!),
    ).toBe(true);
  });
});
