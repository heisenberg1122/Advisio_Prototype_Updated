import { randomUUID } from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { defaultStructuredForm } from "@research-management/validations";
import app from "../app.js";
import { prisma, type InstitutionalRole } from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
const marker = `dean-monitoring-${randomUUID().slice(0, 8)}`;
const fixture = createIntegrationFixtureScope(marker);
let server: http.Server | undefined;
let origin: string;
let dean: string, deanOnly: string, panelist: string, foreign: string;
let foreignCollege: string,
  foreignProgram: string,
  foreignDefense: string,
  projectId: string,
  liveId: string,
  upcomingId: string,
  unreleasedId: string,
  yearId: string;
const future = new Date("2098-06-01T02:00:00Z");
const localLastMinute = new Date("2026-07-02T15:59:59Z");
const nextLocalDay = new Date("2026-07-02T16:00:00Z");
const get = (path: string, token = dean) =>
  fetch(`${origin}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

databaseDescribe("Dean Defenses and Reports API", () => {
  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    await prisma.$transaction(
      async (tx) => {
        const makeCollege = async (suffix: string) => {
          const c = await tx.college.create({
            data: {
              code: `${marker.slice(-8)}${suffix}`,
              name: `College ${suffix} — Peña`,
            },
          });
          fixture.collegeIds.push(c.id);
          const p = await tx.program.create({
            data: {
              collegeId: c.id,
              code: `CS${suffix}`,
              name: `Computing ${suffix}`,
            },
          });
          fixture.programIds.push(p.id);
          const t = await tx.researchType.create({
            data: { programId: p.id, code: "CAP", name: "Capstone" },
          });
          fixture.researchTypeIds.push(t.id);
          return { c, p, t };
        };
        const own = await makeCollege("A"),
          other = await makeCollege("B");
        foreignCollege = other.c.id;
        foreignProgram = other.p.id;
        const makeYear = async (n: number) => {
          const y = await tx.academicYear.create({
            data: {
              name: `DM-${marker.slice(-8)}-${n}`,
              startDate: new Date(`${n}-06-01`),
              endDate: new Date(`${n + 1}-05-31`),
            },
          });
          fixture.academicYearIds.push(y.id);
          return y.id;
        };
        yearId = await makeYear(2098);
        const previous = await makeYear(2097);
        const makeUser = async (
          scope: typeof own,
          roleNames: InstitutionalRole[],
          name: string,
          capacity = 3,
        ) => {
          const u = await tx.user.create({
            data: {
              universityId: `${marker}-${name}`,
              email: `${name}-${marker}@integration.test`,
              firstName: name,
              lastName: "Peña",
              status: "ACTIVE",
              collegeId: scope.c.id,
              programId: scope.p.id,
              maxAdviseeGroups: capacity,
              isAcceptingAdvisees: true,
            },
          });
          fixture.userIds.push(u.id);
          await tx.collegeMembership.create({
            data: { userId: u.id, collegeId: scope.c.id, roleNames },
          });
          return u;
        };
        const d = await makeUser(own, ["DEAN", "PANELIST"], "Dean");
        dean = generateToken(d.id);
        const only = await makeUser(own, ["DEAN"], "Oversight");
        deanOnly = generateToken(only.id);
        const member = await makeUser(own, ["PANELIST"], "Panelist");
        panelist = generateToken(member.id);
        const remoteDean = await makeUser(other, ["DEAN"], "Foreign");
        foreign = generateToken(remoteDean.id);
        const adviser = await makeUser(other, ["ADVISER"], "Adviser", 2);
        await tx.collegeMembership.create({
          data: {
            userId: adviser.id,
            collegeId: own.c.id,
            roleNames: ["ADVISER"],
          },
        });
        const zero = await makeUser(own, ["ADVISER"], "Zero", 0);
        const makeProject = async (
          scope: typeof own,
          y: string,
          title: string,
          createdBy = d.id,
        ) => {
          const p = await tx.researchProject.create({
            data: {
              researchTypeId: scope.t.id,
              collegeId: scope.c.id,
              programId: scope.p.id,
              academicYearId: y,
              title,
              groupName: "Team Ñ",
              status: "DEFENSE",
              createdBy,
            },
          });
          fixture.projectIds.push(p.id);
          return p;
        };
        const p = await makeProject(own, yearId, "=SUM(2+3), “Niño”");
        projectId = p.id;
        const pOld = await makeProject(own, previous, "Previous cohort");
        await makeProject(own, yearId, "Unassigned research");
        const otherP = await makeProject(
          other,
          yearId,
          "PRIVATE other college title",
          remoteDean.id,
        );
        await tx.researchMember.createMany({
          data: [p.id, pOld.id, otherP.id].map((researchId) => ({
            researchId,
            userId: adviser.id,
            projectRole: "ADVISER",
          })),
        });
        await tx.researchMember.create({
          data: {
            researchId: pOld.id,
            userId: zero.id,
            projectRole: "ADVISER",
          },
        });
        const session = await tx.defenseSession.create({
          data: {
            researchId: p.id,
            status: "LIVE",
            scheduledStart: future,
            startedAt: future,
            notes: "PRIVATE scheduling note",
            invitations: {
              create: [
                { inviteeId: d.id, role: "PANEL_CHAIR", status: "ACCEPTED" },
                { inviteeId: member.id, role: "PANELIST", status: "ACCEPTED" },
              ],
            },
          },
        });
        liveId = session.id;
        const manuscript = await tx.document.create({
          data: {
            researchId: p.id,
            title: "Approved manuscript",
            documentType: "MANUSCRIPT",
            currentVersion: 1,
            createdBy: d.id,
          },
        });
        const version = await tx.documentVersion.create({
          data: {
            documentId: manuscript.id,
            versionNumber: 1,
            fileName: "manuscript.pdf",
            mimeType: "application/pdf",
            fileSize: 20,
            storagePath: "test://private-file",
            uploadedBy: d.id,
          },
        });
        await tx.defensePacket.create({
          data: {
            defenseSessionId: liveId,
            manuscriptVersionId: version.id,
            publishedById: d.id,
            publishedAt: future,
            status: "PUBLISHED",
            evaluationMode: "STRUCTURED",
            structuredForm: {
              spec: defaultStructuredForm,
              roster: [{ userId: d.id, name: "Fixture Researcher" }],
              panelists: [d, member].map((user) => ({
                userId: user.id,
                name: user.firstName,
                required: true,
              })),
              researchTitle: p.title,
              manuscriptVersionId: version.id,
              publishedAt: future.toISOString(),
            },
          },
        });
        await tx.structuredEvaluation.create({
          data: {
            defenseSessionId: liveId,
            panelistId: member.id,
            answers: { privateScore: 99 },
            totals: {},
          },
        });
        upcomingId = (
          await tx.defenseSession.create({
            data: {
              researchId: p.id,
              status: "PENDING_ACKNOWLEDGEMENT",
              scheduledStart: future,
              invitations: {
                create: [
                  { inviteeId: d.id, role: "PANEL_CHAIR", status: "PENDING" },
                  { inviteeId: member.id, role: "PANELIST", status: "PENDING" },
                ],
              },
            },
          })
        ).id;
        unreleasedId = (
          await tx.defenseSession.create({
            data: {
              researchId: p.id,
              status: "COMPLETED",
              decision: "REJECTED",
            },
          })
        ).id;
        await tx.defenseSession.createMany({
          data: [
            { researchId: p.id, status: "CANCELLED", scheduledStart: future },
            {
              researchId: p.id,
              status: "COMPLETED",
              releasedAt: localLastMinute,
              decision: "REDEFENSE_REQUIRED",
            },
            {
              researchId: p.id,
              status: "COMPLETED",
              releasedAt: localLastMinute,
              decision: "APPROVED",
            },
            {
              researchId: p.id,
              status: "COMPLETED",
              releasedAt: localLastMinute,
            },
            {
              researchId: p.id,
              status: "COMPLETED",
              releasedAt: nextLocalDay,
              decision: "APPROVED",
            },
          ],
        });
        foreignDefense = (
          await tx.defenseSession.create({
            data: {
              researchId: otherP.id,
              status: "COMPLETED",
              releasedAt: localLastMinute,
              decision: "APPROVED",
            },
          })
        ).id;
      },
      { timeout: 20000 },
    );
    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", resolve),
    );
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }, 30000);

  afterAll(async () => {
    if (server?.listening)
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    await cleanupIntegrationFixture(prisma, fixture);
    await prisma.$disconnect();
  }, 30000);

  it("isolates list, detail, preview and export by active role and college", async () => {
    expect((await get("/dean/defenses", panelist)).status).toBe(403);
    expect(
      (await get(`/dean/defenses?collegeId=${foreignCollege}`)).status,
    ).toBe(403);
    expect((await get(`/dean/defenses/${foreignDefense}`)).status).toBe(404);
    expect((await get(`/dean/defenses/${liveId}`, foreign)).status).toBe(404);
    expect(
      (await get(`/dean/reports/research-progress?programId=${foreignProgram}`))
        .status,
    ).toBe(400);
    expect(
      (
        await get(
          `/dean/reports/defense-outcomes/export?format=csv&collegeId=${foreignCollege}`,
        )
      ).status,
    ).toBe(403);
    expect(
      (await get("/dean/reports/defense-outcomes?to=2026-02-30")).status,
    ).toBe(400);
  });

  it("counts each session once and keeps drafts and unpublished decisions private", async () => {
    const response = await get("/dean/defenses?view=attention");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const list = await response.json();
    expect(list.cards).toMatchObject({ awaitingPanel: 1, awaitingRelease: 1 });
    expect(list.rows.filter((r: any) => r.id === upcomingId)).toHaveLength(1);
    expect(list.rows.find((r: any) => r.id === unreleasedId)).toMatchObject({
      decision: null,
      releasedAt: null,
    });
    expect(list.rows.some((r: any) => r.status === "CANCELLED")).toBe(false);
    const details = await (await get(`/dean/defenses/${liveId}`)).json();
    expect(details.myAssignment).toEqual({
      status: "ACCEPTED",
      canEvaluate: true,
    });
    expect(details.evaluationsSubmitted).toBe(0);
    expect(JSON.stringify(details)).not.toMatch(
      /privateScore|PRIVATE|test:\/\//,
    );
    expect(
      (await (await get(`/dean/defenses/${liveId}`, deanOnly)).json())
        .myAssignment,
    ).toBeNull();
    expect(
      (await get(`/defense-sessions/${liveId}?view=panelist`, deanOnly)).status,
    ).toBe(404);
    const panelView = await (
      await get(`/defense-sessions/${liveId}?view=panelist`)
    ).json();
    expect(panelView.session.structuredEvaluations).toEqual([]);
  });

  it("includes only released outcomes and deduplicates projects inside the Manila date range", async () => {
    const response = await get(
      "/dean/reports/defense-outcomes?from=2026-07-02&to=2026-07-02&pageSize=1",
    );
    expect(response.status).toBe(200);
    const report = await response.json();
    expect(report.rows).toHaveLength(1);
    expect(report.total).toBe(2);
    expect(report.summary).toEqual(
      expect.arrayContaining([
        { label: "Distinct projects", value: 1 },
        { label: "Released records missing valid decision", value: 1 },
      ]),
    );
    expect(report.rows[0].projectId).toBe(projectId);
    expect(report.breakdowns[0].rows[0]).toMatchObject({
      attempts: 2,
      projects: 1,
      APPROVED: 1,
      REDEFENSE_REQUIRED: 1,
    });
  });

  it("separates active load and cohort counts and omits foreign project details", async () => {
    const response = await get(
      `/dean/reports/adviser-workload?academicYearId=${yearId}`,
    );
    expect(response.status).toBe(200);
    const report = await response.json();
    expect(report.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          adviser: "Adviser Peña",
          facultyProgram: "External faculty",
          selectedGroups: 1,
          totalActiveLoad: 3,
          availableSlots: 0,
          utilization: "150%",
        }),
        expect.objectContaining({
          adviser: "Zero Peña",
          selectedGroups: 0,
          utilization: "No capacity",
        }),
      ]),
    );
    expect(report.summary).toContainEqual({
      label: "Unassigned active groups",
      value: 1,
    });
    expect(JSON.stringify(report)).not.toContain("PRIVATE other college title");
  });

  it("exports every filtered row with CSV safety and readable Unicode PDF content", async () => {
    const base = `/dean/reports/research-progress/export?academicYearId=${yearId}&pageSize=1`;
    const csv = await get(`${base}&format=csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toMatch(/^text\/csv/);
    const csvText = await csv.text();
    expect(csvText).toContain(`"'=SUM(2+3), “Niño”"`);
    expect(csvText).toContain("Unassigned research");
    expect(csvText).not.toContain("Previous cohort");
    expect(csvText).not.toContain("PRIVATE other college title");
    const pdf = await get(`${base}&format=pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    const doc = await PDFDocument.load(await pdf.arrayBuffer());
    expect(doc.getTitle()).toBe("Research Progress — College A — Peña");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
