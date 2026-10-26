import crypto from "node:crypto";
import http from "node:http";
import { Readable } from "node:stream";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
import { googleDriveService } from "../services/google-drive.service.js";
import { storageHierarchyService } from "../services/storage-hierarchy.service.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

type Mode = "online" | "onsite" | "hybrid";
type FixtureUser = { id: string; token: string };
type ProjectFixture = {
  id: string;
  student: FixtureUser;
  manuscriptDocumentId: string;
  manuscriptVersionId: string;
  manuscriptFileId: string;
  manuscriptChecksum: string;
  recommendationTemplateVersionId: string;
  evaluationTemplateVersionId: string;
  sessionId?: string;
};

interface FixtureState {
  collegeId: string;
  programId: string;
  academicYearId: string;
  researchTypeId: string;
  workflowId: string;
  stageId: string;
  evaluationTemplateId: string;
  criterionIds: string[];
  professor: FixtureUser;
  dean: FixtureUser;
  chair: FixtureUser;
  panelistOne: FixtureUser;
  panelistTwo: FixtureUser;
  outsider: FixtureUser;
  projects: Record<Mode, ProjectFixture>;
}

type RootSnapshot = Record<
  | "college"
  | "program"
  | "academicYear"
  | "user"
  | "researchType"
  | "workflow"
  | "researchProject",
  string[]
>;

const fixtureSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
const fixtureScope = createIntegrationFixtureScope(
  `defense-e2e-${fixtureSuffix.toLowerCase()}`,
);
const storedFiles = new Map<string, Buffer>();
let uploadSequence = 0;
let server: http.Server | undefined;
let baseUrl = "";
let fixture: FixtureState;
let baseline: RootSnapshot;
let pdf = Buffer.alloc(0);

async function rootSnapshot(): Promise<RootSnapshot> {
  const [
    colleges,
    programs,
    academicYears,
    users,
    researchTypes,
    workflows,
    projects,
  ] = await Promise.all([
    prisma.college.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    prisma.program.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    prisma.academicYear.findMany({
      select: { id: true },
      orderBy: { id: "asc" },
    }),
    prisma.user.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    prisma.researchType.findMany({
      select: { id: true },
      orderBy: { id: "asc" },
    }),
    prisma.workflow.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    prisma.researchProject.findMany({
      select: { id: true },
      orderBy: { id: "asc" },
    }),
  ]);
  return {
    college: colleges.map(({ id }) => id),
    program: programs.map(({ id }) => id),
    academicYear: academicYears.map(({ id }) => id),
    user: users.map(({ id }) => id),
    researchType: researchTypes.map(({ id }) => id),
    workflow: workflows.map(({ id }) => id),
    researchProject: projects.map(({ id }) => id),
  };
}

async function guardedWrite<T>(write: () => Promise<T>): Promise<T> {
  await assertIsolatedIntegrationDatabase(prisma);
  return write();
}

async function request(
  pathname: string,
  token: string,
  init: RequestInit = {},
) {
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<any>;
}

async function apiWrite(
  pathname: string,
  token: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
) {
  await assertIsolatedIntegrationDatabase(prisma);
  return request(pathname, token, {
    method,
    body: JSON.stringify(body),
  });
}

async function closeServer() {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => {
    server!.close((error) => (error ? reject(error) : resolve()));
  });
}

const fieldMapping = (key: string, label: string) => ({
  key,
  label,
  pageNumber: 1,
  x: 0.1,
  y: 0.1,
  width: 0.75,
  height: 0.08,
  preferredFontSize: 10,
  minimumFontSize: 8,
  lineHeight: 1.2,
  alignment: "LEFT",
  multiline: false,
  overflowPolicy: "SHRINK",
  required: true,
});

databaseDescribe("Professor to Panelist to Defense Result API workflow", () => {
  beforeAll(async () => {
    const identity = await assertIsolatedIntegrationDatabase(prisma);
    expect(identity).toMatchObject({
      databaseName: "advisio_test",
      databaseUser: "advisio_test",
      applicationName: "advisio-integration-tests",
      isReplica: false,
    });
    fixtureScope.databaseVerified = true;
    baseline = await rootSnapshot();

    const document = await PDFDocument.create();
    document.addPage([612, 792]);
    pdf = Buffer.from(await document.save());

    vi.spyOn(googleDriveService, "getFileMetadata").mockImplementation(
      async (fileId: string) =>
        storedFiles.has(fileId)
          ? ({
              id: fileId,
              name: `${fileId}.pdf`,
              modifiedTime: new Date().toISOString(),
            } as any)
          : null,
    );
    vi.spyOn(googleDriveService, "getFileStream").mockImplementation(
      async (fileId: string) =>
        ({
          data: Readable.from(storedFiles.get(fileId) || Buffer.alloc(0)),
        }) as any,
    );
    vi.spyOn(googleDriveService, "uploadFile").mockImplementation(
      async ({ fileName, mimeType, buffer }: any) => {
        const fileId = `defense-e2e-generated-${fixtureSuffix}-${++uploadSequence}`;
        storedFiles.set(fileId, Buffer.from(buffer));
        return {
          fileId,
          fileName,
          mimeType,
          sizeBytes: buffer.length,
          webViewLink: `/api/documents/files/${fileId}`,
          webContentLink: `/api/documents/files/${fileId}?download=1`,
          storagePath: `test://${fileId}`,
        };
      },
    );
    vi.spyOn(storageHierarchyService, "resolveFolder").mockResolvedValue(
      `defense-e2e-folder-${fixtureSuffix}`,
    );

    fixture = await guardedWrite(() =>
      prisma.$transaction(async (tx) => {
        const roleNames = [
          "RESEARCHER",
          "PANELIST",
          "RESEARCH_COORDINATOR",
          "DEAN",
        ] as const;
        for (const name of roleNames) {
          await tx.role.upsert({
            where: { name },
            update: {},
            create: { name, description: `Defense E2E ${name}` },
          });
        }
        const roles = await tx.role.findMany({
          where: { name: { in: [...roleNames] } },
        });
        const roleByName = new Map(roles.map((role) => [role.name, role.id]));

        const college = await tx.college.create({
          data: {
            code: `DE${fixtureSuffix}`,
            name: `Defense E2E College ${fixtureSuffix}`,
          },
        });
        const program = await tx.program.create({
          data: {
            collegeId: college.id,
            code: `DEIT${fixtureSuffix}`,
            name: `Defense E2E Program ${fixtureSuffix}`,
          },
        });
        const academicYear = await tx.academicYear.create({
          data: {
            name: `DE-${fixtureSuffix}`,
            startDate: new Date("2098-06-01T00:00:00.000Z"),
            endDate: new Date("2099-05-31T00:00:00.000Z"),
          },
        });

        const createUser = async (
          name: string,
          role: (typeof roleNames)[number],
        ) => {
          const user = await tx.user.create({
            data: {
              universityId: `DE-${fixtureSuffix}-${name.toUpperCase()}`,
              email: `defense-e2e-${fixtureSuffix.toLowerCase()}-${name}@integration.test`,
              firstName: name,
              lastName: "Defense Fixture",
              status: "ACTIVE",
              collegeId: college.id,
              programId: program.id,
            },
          });
          await tx.userRole.create({
            data: { userId: user.id, roleId: roleByName.get(role)! },
          });
          return { id: user.id, token: generateToken(user.id) };
        };

        const professor = await createUser("professor", "RESEARCH_COORDINATOR");
        const dean = await createUser("dean", "DEAN");
        const chair = await createUser("chair", "PANELIST");
        const panelistOne = await createUser("panelist-one", "PANELIST");
        const panelistTwo = await createUser("panelist-two", "PANELIST");
        const outsider = await createUser("outsider", "PANELIST");
        const onlineStudent = await createUser("online-student", "RESEARCHER");
        const onsiteStudent = await createUser("onsite-student", "RESEARCHER");
        const hybridStudent = await createUser("hybrid-student", "RESEARCHER");

        const researchType = await tx.researchType.create({
          data: {
            programId: program.id,
            name: `Defense E2E Research ${fixtureSuffix}`,
            code: `DE-${fixtureSuffix}`,
          },
        });
        const workflow = await tx.workflow.create({
          data: {
            researchTypeId: researchType.id,
            name: `Defense E2E Workflow ${fixtureSuffix}`,
            version: 1,
            status: "PUBLISHED",
            createdBy: professor.id,
            publishedAt: new Date(),
          },
        });
        await tx.researchType.update({
          where: { id: researchType.id },
          data: { workflowId: workflow.id },
        });
        const stage = await tx.workflowStage.create({
          data: {
            workflowId: workflow.id,
            name: "Approved defense manuscript",
            sequence: 1,
            responsibleRoleId: roleByName.get("RESEARCH_COORDINATOR")!,
            isFinal: true,
          },
        });
        const evaluationTemplate = await tx.evaluationTemplate.create({
          data: {
            name: `Defense E2E Rubric ${fixtureSuffix}`,
            researchTypeId: researchType.id,
            version: 1,
            totalScore: 30,
            criteria: {
              create: [
                { criterion: "Research quality", maxScore: 10, sequence: 1 },
                { criterion: "Presentation", maxScore: 10, sequence: 2 },
                { criterion: "Responses", maxScore: 10, sequence: 3 },
              ],
            },
          },
          include: { criteria: { orderBy: { sequence: "asc" } } },
        });

        const makeVersion = async (
          documentId: string,
          fileId: string,
          uploadedBy: string,
          extra: Record<string, unknown> = {},
        ) => {
          storedFiles.set(fileId, pdf);
          return tx.documentVersion.create({
            data: {
              documentId,
              versionNumber: 1,
              fileName: `${fileId}.pdf`,
              mimeType: "application/pdf",
              fileSize: BigInt(pdf.length),
              storagePath: `test://${fileId}`,
              googleDriveFileId: fileId,
              uploadedBy,
              ...extra,
            } as any,
          });
        };

        const createProject = async (mode: Mode, student: FixtureUser) => {
          const project = await tx.researchProject.create({
            data: {
              researchTypeId: researchType.id,
              programId: program.id,
              collegeId: college.id,
              academicYearId: academicYear.id,
              title: `${mode.toUpperCase()} Defense E2E ${fixtureSuffix}`,
              groupName: `${mode.toUpperCase()}-${fixtureSuffix}`,
              participationMode: "GROUP",
              status: "COMPLETED",
              completedAt: new Date(),
              createdBy: student.id,
            },
          });
          await tx.researchMember.create({
            data: {
              researchId: project.id,
              userId: student.id,
              projectRole: "LEADER",
            },
          });
          const instance = await tx.workflowInstance.create({
            data: {
              researchId: project.id,
              workflowId: workflow.id,
              workflowVersion: workflow.version,
              currentStageId: stage.id,
              completedAt: new Date(),
            },
          });
          await tx.researchProject.update({
            where: { id: project.id },
            data: { workflowInstanceId: instance.id },
          });

          const manuscript = await tx.document.create({
            data: {
              researchId: project.id,
              milestoneId: stage.id,
              documentType: "MANUSCRIPT",
              title: `${mode} approved manuscript`,
              currentVersion: 1,
              storageProvider: "GOOGLE_DRIVE",
              lifecycleStatus: "APPROVED",
              createdBy: student.id,
            },
          });
          const manuscriptChecksum = crypto
            .createHash("sha256")
            .update(pdf)
            .digest("hex");
          const manuscriptFileId = `defense-e2e-${fixtureSuffix}-${mode}-manuscript`;
          const manuscriptVersion = await makeVersion(
            manuscript.id,
            manuscriptFileId,
            student.id,
            {
              manuscriptStatus: "APPROVED",
              isImmutable: true,
              contentChecksum: manuscriptChecksum,
              submissionKey: `defense-e2e-${fixtureSuffix}-${mode}`,
              submittedBy: student.id,
              submittedAt: new Date(),
              snapshotCreatedAt: new Date(),
              milestoneId: stage.id,
            },
          );
          const assignment = await tx.reviewerAssignment.create({
            data: {
              researchId: project.id,
              documentId: manuscript.id,
              documentVersionId: manuscriptVersion.id,
              reviewerId: professor.id,
              reviewType: "COORDINATOR",
              isRequired: true,
              assignedById: professor.id,
              status: "COMPLETED",
              completedAt: new Date(),
            },
          });
          await tx.review.create({
            data: {
              assignmentId: assignment.id,
              documentVersionId: manuscriptVersion.id,
              documentId: manuscript.id,
              reviewerId: professor.id,
              reviewType: "COORDINATOR",
              recommendation: "APPROVE",
              status: "SUBMITTED",
              submittedAt: new Date(),
            },
          });

          const approval = await tx.document.create({
            data: {
              researchId: project.id,
              documentType: "DEAN_DEFENSE_APPROVAL",
              title: `${mode} signed dean approval`,
              currentVersion: 2,
              storageProvider: "GOOGLE_DRIVE",
              lifecycleStatus: "APPROVED",
              createdBy: professor.id,
            },
          });
          const approvalSource = await makeVersion(
            approval.id,
            `defense-e2e-${fixtureSuffix}-${mode}-approval-source`,
            professor.id,
            { status: "SUPERSEDED" },
          );
          const approvalSigned = await tx.documentVersion.create({
            data: {
              documentId: approval.id,
              versionNumber: 2,
              fileName: `${mode}-signed-approval.pdf`,
              mimeType: "application/pdf",
              fileSize: BigInt(pdf.length),
              storagePath: `test://defense-e2e-${fixtureSuffix}-${mode}-approval-signed`,
              googleDriveFileId: `defense-e2e-${fixtureSuffix}-${mode}-approval-signed`,
              uploadedBy: dean.id,
              status: "ACTIVE",
            },
          });
          storedFiles.set(approvalSigned.googleDriveFileId!, pdf);
          await tx.documentSignature.create({
            data: {
              sourceVersionId: approvalSource.id,
              signedVersionId: approvalSigned.id,
              signedById: dean.id,
              originalFileHash: manuscriptChecksum,
              signedFileHash: manuscriptChecksum,
              placements: [
                { pageNumber: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
              ],
              authenticationMethod: "INTEGRATION_TEST",
              verificationCode: `DE${fixtureSuffix}${mode}`.slice(0, 32),
            },
          });

          const recommendationTemplate = await tx.document.create({
            data: {
              researchId: project.id,
              documentType: "RECOMMENDATION_TEMPLATE",
              title: `${mode} recommendation template`,
              storageProvider: "GOOGLE_DRIVE",
              createdBy: professor.id,
            },
          });
          const recommendationTemplateVersion = await makeVersion(
            recommendationTemplate.id,
            `defense-e2e-${fixtureSuffix}-${mode}-recommendation-template`,
            professor.id,
          );
          const evaluationDocument = await tx.document.create({
            data: {
              researchId: project.id,
              documentType: "EVALUATION_TEMPLATE",
              title: `${mode} evaluation template`,
              storageProvider: "GOOGLE_DRIVE",
              createdBy: professor.id,
            },
          });
          const evaluationTemplateVersion = await makeVersion(
            evaluationDocument.id,
            `defense-e2e-${fixtureSuffix}-${mode}-evaluation-template`,
            professor.id,
          );

          return {
            id: project.id,
            student,
            manuscriptDocumentId: manuscript.id,
            manuscriptVersionId: manuscriptVersion.id,
            manuscriptFileId,
            manuscriptChecksum,
            recommendationTemplateVersionId: recommendationTemplateVersion.id,
            evaluationTemplateVersionId: evaluationTemplateVersion.id,
          };
        };

        const projects = {
          online: await createProject("online", onlineStudent),
          onsite: await createProject("onsite", onsiteStudent),
          hybrid: await createProject("hybrid", hybridStudent),
        };

        return {
          collegeId: college.id,
          programId: program.id,
          academicYearId: academicYear.id,
          researchTypeId: researchType.id,
          workflowId: workflow.id,
          stageId: stage.id,
          evaluationTemplateId: evaluationTemplate.id,
          criterionIds: evaluationTemplate.criteria.map(({ id }) => id),
          professor,
          dean,
          chair,
          panelistOne,
          panelistTwo,
          outsider,
          projects,
        };
      }),
    );

    fixtureScope.collegeIds.push(fixture.collegeId);
    fixtureScope.programIds.push(fixture.programId);
    fixtureScope.academicYearIds.push(fixture.academicYearId);
    fixtureScope.researchTypeIds.push(fixture.researchTypeId);
    fixtureScope.workflowIds.push(fixture.workflowId);
    fixtureScope.userIds.push(
      fixture.professor.id,
      fixture.dean.id,
      fixture.chair.id,
      fixture.panelistOne.id,
      fixture.panelistTwo.id,
      fixture.outsider.id,
      ...Object.values(fixture.projects).map(({ student }) => student.id),
    );
    fixtureScope.projectIds.push(
      ...Object.values(fixture.projects).map(({ id }) => id),
    );

    await new Promise<void>((resolve, reject) => {
      const candidate = http.createServer(app);
      server = candidate;
      candidate.once("error", reject);
      candidate.listen(0, "127.0.0.1", () => {
        const address = candidate.address();
        if (!address || typeof address === "string") {
          reject(new Error("Defense E2E server did not expose a TCP port."));
          return;
        }
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  }, 60_000);

  afterAll(async () => {
    const teardownErrors: unknown[] = [];
    try {
      await closeServer();
    } catch (error) {
      teardownErrors.push(error);
    }
    try {
      await guardedWrite(() =>
        prisma.documentSignature.deleteMany({
          where: {
            sourceVersion: {
              document: { researchId: { in: fixtureScope.projectIds } },
            },
          },
        }),
      );
      await assertIsolatedIntegrationDatabase(prisma);
      await guardedWrite(() => prisma.defenseEvent.deleteMany({
        where: { collegeId: { in: fixtureScope.collegeIds }, createdBy: { in: fixtureScope.userIds } },
      }));
      await cleanupIntegrationFixture(prisma, fixtureScope);
      if (baseline) expect(await rootSnapshot()).toEqual(baseline);
    } catch (error) {
      teardownErrors.push(error);
    }
    vi.restoreAllMocks();
    await prisma.$disconnect();
    if (teardownErrors.length) {
      throw new AggregateError(
        teardownErrors,
        `Defense E2E fixture cleanup failed for ${fixtureScope.marker}.`,
      );
    }
  }, 60_000);

  it("completes online, on-site, and hybrid defenses with scoped immutable records", async () => {
    const modes: Array<{
      mode: Mode;
      venue?: string;
      meetingUrl?: string;
    }> = [
      {
        mode: "online",
        meetingUrl: "https://meet.example.test/defense-online",
      },
      { mode: "onsite", venue: "UA Testing Hall 204" },
      {
        mode: "hybrid",
        venue: "UA Hybrid Room 301",
        meetingUrl: "https://meet.example.test/defense-hybrid",
      },
    ];
    const panelists = [fixture.chair, fixture.panelistOne, fixture.panelistTwo];
    const inviteeRoles = ["PANEL_CHAIR", "PANELIST", "PANELIST"];
    const scheduleStart = new Date("2098-11-15T01:00:00.000Z");

    for (const [index, definition] of modes.entries()) {
      const project = fixture.projects[definition.mode];
      const scheduledStart = new Date(
        scheduleStart.getTime() + index * 7_200_000,
      );
      const scheduledEnd = new Date(scheduledStart.getTime() + 5_400_000);
      const createResponse = await apiWrite(
        "/api/defense-management",
        fixture.professor.token,
        "POST",
        {
          researchId: project.id,
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd.toISOString(),
          venue: definition.venue,
          meetingUrl: definition.meetingUrl,
          notes: `${definition.mode} disposable defense verification`,
          invitees: panelists.map((panelist, panelistIndex) => ({
            userId: panelist.id,
            role: inviteeRoles[panelistIndex],
            isRequired: true,
          })),
        },
      );
      expect(createResponse.status).toBe(201);
      const created = await readJson(createResponse);
      project.sessionId = created.session.id;
      expect(created.session).toMatchObject({
        status: "PENDING_ACKNOWLEDGEMENT",
        venue: definition.venue || null,
        meetingUrl: definition.meetingUrl || null,
      });

      if (definition.mode === "online") {
        const pendingWorkspace = await request(
          `/api/defense-sessions/${project.sessionId}`,
          fixture.panelistOne.token,
        );
        expect(pendingWorkspace.status).toBe(200);
        expect(await readJson(pendingWorkspace)).toMatchObject({
          session: {
            id: project.sessionId,
            deliveryMode: "ONLINE",
            meetingUrl: null,
            invitations: [{ status: "PENDING" }],
          },
        });

        const tentativeCalendar = await request(
          "/api/calendar?start=2098-11-01&end=2098-12-01",
          fixture.panelistOne.token,
        );
        expect(tentativeCalendar.status).toBe(200);
        expect((await readJson(tentativeCalendar)).events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: `defense:${project.sessionId}`,
              invitationStatus: "PENDING",
              meetingUrl: null,
              actionUrl: `/panelist/defenses/${project.sessionId}`,
            }),
          ]),
        );
      }

      const invitations = await prisma.defenseInvitation.findMany({
        where: { defenseSessionId: project.sessionId },
      });
      expect(invitations).toHaveLength(3);
      for (const panelist of panelists) {
        const invitation = invitations.find(
          ({ inviteeId }) => inviteeId === panelist.id,
        )!;
        const response = await apiWrite(
          `/api/defense-management/invitations/${invitation.id}/respond`,
          panelist.token,
          "PATCH",
          { response: "ACCEPTED", suggestedAvailability: [] },
        );
        expect(response.status).toBe(200);
      }
      expect(
        await prisma.defenseSession.findUniqueOrThrow({
          where: { id: project.sessionId },
        }),
      ).toMatchObject({ status: "SCHEDULED" });

      const readinessResponse = await request(
        `/api/defense-sessions/${project.sessionId}/manuscript-readiness`,
        fixture.professor.token,
      );
      expect(readinessResponse.status).toBe(200);
      const readiness = await readJson(readinessResponse);
      expect(readiness.readiness.eligibleVersions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: project.manuscriptVersionId,
            eligible: true,
          }),
        ]),
      );

      const packetResponse = await apiWrite(
        `/api/defense-sessions/${project.sessionId}/review-packet`,
        fixture.professor.token,
        "PUT",
        {
          manuscriptVersionId: project.manuscriptVersionId,
          recommendationTemplateVersionId:
            project.recommendationTemplateVersionId,
          evaluationTemplateVersionId: project.evaluationTemplateVersionId,
          recommendationFieldMappings: [
            fieldMapping("decision", "Panel decision"),
          ],
          evaluationFieldMappings: [fieldMapping("totalScore", "Total score")],
          reviewDeadline: new Date(
            scheduledStart.getTime() - 86_400_000,
          ).toISOString(),
          publish: true,
        },
      );
      expect(packetResponse.status).toBe(200);
      const packet = await readJson(packetResponse);
      expect(packet.packet).toMatchObject({
        status: "PUBLISHED",
        manuscriptVersionId: project.manuscriptVersionId,
      });
    }

    expect(
      await prisma.notification.count({
        where: {
          recipientId: fixture.panelistOne.id,
          type: "DEFENSE_INVITATION",
          entityId: {
            in: Object.values(fixture.projects).map(
              ({ sessionId }) => sessionId!,
            ),
          },
        },
      }),
    ).toBe(3);
    expect(
      await prisma.notification.count({
        where: {
          recipientId: fixture.panelistOne.id,
          type: "DOCUMENT_UPLOADED",
        },
      }),
    ).toBe(3);

    const online = fixture.projects.online;
    const onlineDetailBeforeStart = await request(
      `/api/defense-sessions/${online.sessionId}`,
      fixture.panelistOne.token,
    );
    expect(onlineDetailBeforeStart.status).toBe(200);
    expect(await readJson(onlineDetailBeforeStart)).toMatchObject({
      session: {
        id: online.sessionId,
        status: "SCHEDULED",
        venue: null,
        meetingUrl: "https://meet.example.test/defense-online",
      },
    });

    const previewResponse = await request(
      `/api/documents/files/${online.manuscriptFileId}`,
      fixture.panelistOne.token,
    );
    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers.get("content-disposition")).toContain(
      "inline",
    );
    expect(
      Buffer.from(await previewResponse.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    const downloadResponse = await request(
      `/api/documents/files/${online.manuscriptFileId}?download=1`,
      fixture.panelistOne.token,
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-disposition")).toContain(
      "attachment",
    );

    const outsiderPreview = await request(
      `/api/documents/files/${online.manuscriptFileId}`,
      fixture.outsider.token,
    );
    expect(outsiderPreview.status).toBe(403);

    const reviewResponse = await apiWrite(
      `/api/defense-sessions/${online.sessionId}/manuscript-review`,
      fixture.panelistOne.token,
      "PUT",
      {
        privateNotes: "Privately verify the limitations section.",
        annotations: [
          { page: 3, text: "Clarify the sampling frame", color: "amber" },
        ],
        revisionChecklist: [
          {
            id: "methods",
            label: "Revise methodology wording",
            required: true,
          },
        ],
        reviewed: true,
      },
    );
    expect(reviewResponse.status).toBe(200);
    expect(await readJson(reviewResponse)).toMatchObject({
      review: { privateNotes: "Privately verify the limitations section." },
    });

    const recommendationDraft = await apiWrite(
      `/api/defense-sessions/${online.sessionId}/recommendation`,
      fixture.panelistOne.token,
      "PUT",
      {
        responses: {
          decision: "Minor revisions",
          notes: "Clarify the sampling frame.",
        },
      },
    );
    expect(recommendationDraft.status).toBe(200);
    expect(await readJson(recommendationDraft)).toMatchObject({
      recommendation: { status: "DRAFT" },
    });
    const recommendationPreview = await apiWrite(
      `/api/defense-sessions/${online.sessionId}/recommendation/preview`,
      fixture.panelistOne.token,
      "POST",
      {},
    );
    expect(recommendationPreview.status).toBe(200);
    const recommendationPdf = await request(
      `/api/defense-sessions/${online.sessionId}/recommendation/preview`,
      fixture.panelistOne.token,
    );
    expect(recommendationPdf.status).toBe(200);
    expect(
      Buffer.from(await recommendationPdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");

    const panelistTwoPacket = await request(
      `/api/defense-sessions/${online.sessionId}/review-packet`,
      fixture.panelistTwo.token,
    );
    expect(panelistTwoPacket.status).toBe(200);
    expect((await readJson(panelistTwoPacket)).review).toBeNull();
    const outsiderPacket = await request(
      `/api/defense-sessions/${online.sessionId}/review-packet`,
      fixture.outsider.token,
    );
    expect(outsiderPacket.status).toBe(404);
    const outsiderReview = await apiWrite(
      `/api/defense-sessions/${online.sessionId}/manuscript-review`,
      fixture.outsider.token,
      "PUT",
      { privateNotes: "Unauthorized", reviewed: true },
    );
    expect(outsiderReview.status).toBe(403);

    expect(
      await prisma.defenseSession.findUniqueOrThrow({
        where: { id: online.sessionId },
      }),
    ).toMatchObject({ status: "SCHEDULED", startedAt: null });

    const unauthorizedStart = await apiWrite(
      "/api/defense-sessions/start",
      fixture.panelistOne.token,
      "POST",
      { sessionId: online.sessionId },
    );
    expect(unauthorizedStart.status).toBe(403);

    for (const { mode } of modes) {
      const startResponse = await apiWrite(
        "/api/defense-sessions/start",
        fixture.professor.token,
        "POST",
        { sessionId: fixture.projects[mode].sessionId },
      );
      expect(startResponse.status).toBe(200);
      expect(await readJson(startResponse)).toMatchObject({
        session: { id: fixture.projects[mode].sessionId, status: "LIVE" },
      });
    }
    expect(
      await prisma.defenseSession.count({
        where: {
          id: {
            in: Object.values(fixture.projects).map(
              ({ sessionId }) => sessionId!,
            ),
          },
          status: "LIVE",
        },
      }),
    ).toBe(3);

    const targetedActive = await request(
      `/api/defense-sessions/active?sessionId=${fixture.projects.hybrid.sessionId}`,
      fixture.panelistOne.token,
    );
    expect(targetedActive.status).toBe(200);
    expect(await readJson(targetedActive)).toMatchObject({
      session: {
        id: fixture.projects.hybrid.sessionId,
        venue: "UA Hybrid Room 301",
        meetingUrl: "https://meet.example.test/defense-hybrid",
      },
    });

    const partialScores = [
      {
        criterionId: fixture.criterionIds[0],
        score: 0,
        comment: "Intentional zero",
      },
    ];
    const incompleteFinal = await apiWrite(
      `/api/defense-sessions/${online.sessionId}/evaluation`,
      fixture.panelistOne.token,
      "PUT",
      {
        templateId: fixture.evaluationTemplateId,
        recommendation: "MINOR_REVISION",
        criteriaScores: partialScores,
        remarks: "Incomplete final must fail.",
        final: true,
      },
    );
    expect(incompleteFinal.status).toBe(400);

    const draft = await apiWrite(
      `/api/defense-sessions/${online.sessionId}/evaluation`,
      fixture.panelistOne.token,
      "PUT",
      {
        templateId: fixture.evaluationTemplateId,
        recommendation: "MINOR_REVISION",
        criteriaScores: partialScores,
        remarks: "Partial draft retained.",
        final: false,
      },
    );
    expect(draft.status).toBe(200);
    expect(await readJson(draft)).toMatchObject({
      evaluation: { status: "DRAFT", totalScore: "0" },
      calculatedTotal: 0,
    });
    const storedDraft = await prisma.evaluation.findUniqueOrThrow({
      where: {
        defenseSessionId_evaluatorId: {
          defenseSessionId: online.sessionId!,
          evaluatorId: fixture.panelistOne.id,
        },
      },
    });
    expect(storedDraft.criteriaScores).toEqual([
      expect.objectContaining({
        criterionId: fixture.criterionIds[0],
        score: 0,
      }),
      expect.objectContaining({ criterionId: fixture.criterionIds[1] }),
      expect.objectContaining({ criterionId: fixture.criterionIds[2] }),
    ]);
    expect((storedDraft.criteriaScores as any[])[1]).not.toHaveProperty(
      "score",
    );

    const unauthorizedEvaluation = await apiWrite(
      `/api/defense-sessions/${online.sessionId}/evaluation`,
      fixture.outsider.token,
      "PUT",
      {
        templateId: fixture.evaluationTemplateId,
        recommendation: "APPROVE",
        criteriaScores: fixture.criterionIds.map((criterionId) => ({
          criterionId,
          score: 8,
        })),
        final: true,
      },
    );
    expect(unauthorizedEvaluation.status).toBe(403);

    const prematureRelease = await apiWrite(
      `/api/defense-sessions/${online.sessionId}/release`,
      fixture.professor.token,
      "POST",
      { decision: "APPROVED" },
    );
    expect(prematureRelease.status).toBe(409);
    expect((await readJson(prematureRelease)).error).toContain("Waiting for 3");

    const scoreFor = (panelistIndex: number) =>
      fixture.criterionIds.map((criterionId, criterionIndex) => ({
        criterionId,
        score:
          panelistIndex === 1 && criterionIndex === 0 ? 0 : 8 + criterionIndex,
        comment: `Panelist ${panelistIndex} criterion ${criterionIndex}`,
      }));

    for (const { mode } of modes) {
      const project = fixture.projects[mode];
      for (const [panelistIndex, panelist] of panelists.entries()) {
        const finalResponse = await apiWrite(
          `/api/defense-sessions/${project.sessionId}/evaluation`,
          panelist.token,
          "PUT",
          {
            templateId: fixture.evaluationTemplateId,
            recommendation: panelistIndex === 1 ? "MINOR_REVISION" : "APPROVE",
            criteriaScores: scoreFor(panelistIndex),
            remarks: `${mode} independent final evaluation`,
            final: true,
          },
        );
        const finalBody = await readJson(finalResponse);
        expect(finalResponse.status, JSON.stringify(finalBody)).toBe(200);
        expect(finalBody.evaluation).toMatchObject({
          defenseSessionId: project.sessionId,
          evaluatorId: panelist.id,
          status: "LOCKED",
        });
        expect(finalBody.evaluation.integrityHash).toHaveLength(64);
        expect(finalBody.generatedVersion).toMatchObject({
          mimeType: "application/pdf",
        });
      }
    }

    const zeroEvaluation = await prisma.evaluation.findUniqueOrThrow({
      where: {
        defenseSessionId_evaluatorId: {
          defenseSessionId: online.sessionId!,
          evaluatorId: fixture.panelistOne.id,
        },
      },
    });
    expect((zeroEvaluation.criteriaScores as any[])[0].score).toBe(0);
    expect(Number(zeroEvaluation.totalScore)).toBe(19);

    const lockedModification = await apiWrite(
      `/api/defense-sessions/${online.sessionId}/evaluation`,
      fixture.panelistOne.token,
      "PUT",
      {
        templateId: fixture.evaluationTemplateId,
        recommendation: "APPROVE",
        criteriaScores: scoreFor(0),
        final: false,
      },
    );
    expect(lockedModification.status).toBe(409);
    expect(
      await prisma.evaluation.count({
        where: {
          defenseSessionId: fixture.projects.hybrid.sessionId,
          status: "LOCKED",
        },
      }),
    ).toBe(3);

    const decisions: Record<Mode, any> = {
      online: {
        decision: "APPROVED_WITH_MINOR_REVISIONS",
        revisionInstructions:
          "Clarify the sampling frame and preserve the approved defense snapshot.",
      },
      onsite: { decision: "APPROVED" },
      hybrid: { decision: "APPROVED" },
    };
    for (const { mode } of modes) {
      const release = await apiWrite(
        `/api/defense-sessions/${fixture.projects[mode].sessionId}/release`,
        fixture.professor.token,
        "POST",
        decisions[mode],
      );
      expect(release.status).toBe(200);
      expect(await readJson(release)).toMatchObject({
        session: {
          id: fixture.projects[mode].sessionId,
          status: "COMPLETED",
          decision: decisions[mode].decision,
        },
      });
    }

    for (const { mode } of modes) {
      const project = fixture.projects[mode];
      const result = await request(
        `/api/research/${project.id}/defense-result`,
        project.student.token,
      );
      expect(result.status).toBe(200);
      expect(await readJson(result)).toMatchObject({
        result: {
          id: project.sessionId,
          decision: decisions[mode].decision,
        },
      });
      const notifications = await request(
        "/api/notifications?inbox=researcher",
        project.student.token,
      );
      expect(notifications.status).toBe(200);
      expect((await readJson(notifications)).notifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Official defense result released",
            entityId: project.sessionId,
          }),
        ]),
      );
    }

    const archive = await request(
      "/api/panelist/dashboard-summary",
      fixture.panelistOne.token,
    );
    expect(archive.status).toBe(200);
    const archiveBody = await readJson(archive);
    expect(archiveBody.archives.map(({ id }: any) => id)).toEqual(
      expect.arrayContaining(
        Object.values(fixture.projects).map(({ sessionId }) => sessionId),
      ),
    );

    const preservedVersion = await prisma.documentVersion.findUniqueOrThrow({
      where: { id: online.manuscriptVersionId },
    });
    expect(preservedVersion).toMatchObject({
      isImmutable: true,
      contentChecksum: online.manuscriptChecksum,
      manuscriptStatus: "APPROVED",
    });
    const preservedPacket = await prisma.defensePacket.findUniqueOrThrow({
      where: { defenseSessionId: online.sessionId },
    });
    expect(preservedPacket.manuscriptVersionId).toBe(
      online.manuscriptVersionId,
    );
    expect(
      await prisma.manuscriptStatusEvent.count({
        where: {
          documentId: online.manuscriptDocumentId,
          versionId: online.manuscriptVersionId,
          toStatus: "REVISION_REQUIRED",
        },
      }),
    ).toBe(1);
    expect(
      await prisma.document.findUniqueOrThrow({
        where: { id: online.manuscriptDocumentId },
      }),
    ).toMatchObject({ lifecycleStatus: "REVISION_REQUIRED" });
  }, 120_000);

  it("issues title/final badges once and exposes them only through authorized defense reads", async () => {
    for (const [mode, defenseType] of [["onsite", "TITLE_DEFENSE"], ["hybrid", "FINAL_ORAL_DEFENSE"]] as const) {
      const project = fixture.projects[mode];
      const event = await guardedWrite(() => prisma.defenseEvent.create({ data: {
        code: `BADGE-${crypto.randomBytes(6).toString("hex")}`,
        collegeId: fixture.collegeId, createdBy: fixture.professor.id,
        defenseType, status: "COMPLETED", scheduledStart: new Date(), scheduledEnd: new Date(),
      } }));
      await guardedWrite(() => prisma.defenseSession.update({
        where: { id: project.sessionId }, data: { defenseEventId: event.id },
      }));
      const endpoint = `/api/defense-sessions/${project.sessionId}/badge`;
      const forbidden = await apiWrite(endpoint, project.student.token, "POST", {});
      expect(forbidden.status).toBe(403);
      const responses = await Promise.all([
        apiWrite(endpoint, fixture.professor.token, "POST", {}),
        apiWrite(endpoint, fixture.professor.token, "POST", {}),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
      const awards = await Promise.all(responses.map(readJson));
      expect(awards[0].badge.id).toBe(awards[1].badge.id);
      expect(awards[0].badge.kind).toBe(mode === "onsite" ? "TITLE_DEFENSE" : "FINAL_DEFENSE");
      const visible = await request(`/api/defense-sessions/${project.sessionId}`, project.student.token);
      expect(visible.status).toBe(200);
      expect((await readJson(visible)).session.badge).toMatchObject({
        id: awards[0].badge.id, recipients: expect.arrayContaining([expect.objectContaining({ userId: project.student.id })]),
      });
      const otherGroup = await request(`/api/defense-sessions/${project.sessionId}`, fixture.projects.online.student.token);
      expect(otherGroup.status).toBe(404);
      expect(await prisma.auditLog.count({ where: { entityType: "DefenseBadge", entityId: awards[0].badge.id } })).toBe(1);
    }
  }, 60_000);
});
