import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import { prisma, type InstitutionalRole } from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
import { ConsultationCalendarError, googleCalendarService } from "../services/google-calendar.service.js";
import { syncConsultationCancellation, syncConsultationUpdate } from "../services/consultation-lifecycle.service.js";
import {
  assertIsolatedIntegrationDatabase, cleanupIntegrationFixture, createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
const marker = `consultations-${randomUUID().slice(0, 8)}`;
const fixture = createIntegrationFixtureScope(marker);
const dates = { scheduledStart: "2098-07-12T02:00:00.000Z", scheduledEnd: "2098-07-12T03:00:00.000Z" };
const links = ["abc-defg-hij", "bcd-efgh-ijk", "cde-fghi-jkl", "def-ghij-klm", "efg-hijk-lmn"];
type Account = { id: string; token: string; email: string };
let student: Account, peer: Account, adviser: Account, panelist: Account, dean: Account, coordinator: Account, oversight: Account, outsider: Account;
let projectId: string;
const otherGroups: { researchId: string; researcher: Account }[] = [];
let server: Server;
let origin: string;

async function startApi() {
  server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.on("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No API test port.");
  origin = `http://127.0.0.1:${address.port}/api`;
}

const stopApi = () => new Promise<void>((resolve, reject) =>
  server.close((error) => error ? reject(error) : resolve()),
);

async function request(user: Account, path = "/consultations", method = "GET", body?: object) {
  const result = await fetch(origin + path, {
    method,
    headers: { Authorization: `Bearer ${user.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: result.status, data: await result.json() };
}

const schedule = (title: string, participantIds: string[], extra = {}) => ({
  title, researchId: projectId, participantIds, ...dates, requestKey: randomUUID(), ...extra,
});
const slot = (hour: number) => ({
  scheduledStart: new Date(Date.UTC(2098, 6, 12, hour)).toISOString(),
  scheduledEnd: new Date(Date.UTC(2098, 6, 12, hour + 1)).toISOString(),
});
const add = (user: Account, payload: object) => request(user, "/consultations", "POST", payload);
const change = (user: Account, id: string, body: object) => request(user, `/consultations/${id}`, "PATCH", body);
const approve = (user: Account, id: string, body = {}) => request(user, `/consultations/${id}/approve`, "PATCH", body);
const join = (user: Account, id: string) => request(user, `/consultations/${id}/join`, "POST", {});
const calendar = (user: Account) => request(user, "/calendar?start=2098-07-10T00:00:00.000Z&end=2098-07-14T00:00:00.000Z");

databaseDescribe("consultation HTTP lifecycle with PostgreSQL", () => {
  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    await prisma.$transaction(async (tx) => {
      const own = await tx.college.create({ data: { code: `CM${marker.slice(-8)}`, name: `Consultation ${marker}` } });
      const other = await tx.college.create({ data: { code: `CF${marker.slice(-8)}`, name: `Foreign ${marker}` } });
      fixture.collegeIds.push(own.id, other.id);
      const program = await tx.program.create({ data: { collegeId: own.id, code: "CONS", name: `Consultation ${marker}` } });
      fixture.programIds.push(program.id);
      const researchType = await tx.researchType.create({ data: { programId: program.id, code: "CONS", name: "Consultation test" } });
      fixture.researchTypeIds.push(researchType.id);
      const year = await tx.academicYear.create({ data: {
        name: `CM-${marker.slice(-8)}`, startDate: new Date("2098-01-01"), endDate: new Date("2099-01-01"),
      } });
      fixture.academicYearIds.push(year.id);
      async function createUser(name: string, role: InstitutionalRole, collegeId = own.id): Promise<Account> {
        const { id: roleId } = await tx.role.upsert({ where: { name: role }, create: { name: role }, update: {} });
        const email = `${name}-${marker}@integration.test`;
        const user = await tx.user.create({ data: {
          email, firstName: name, lastName: "Test", universityId: `${name}-${marker}`,
          collegeId, status: "ACTIVE", roles: { create: { roleId } },
          ...(role === "RESEARCHER" ? {} : { collegeMemberships: { create: { collegeId, roleNames: [role] } } }),
        } });
        fixture.userIds.push(user.id);
        return { id: user.id, email, token: generateToken(user.id) };
      }
      student = await createUser("Student", "RESEARCHER");
      peer = await createUser("Peer", "RESEARCHER");
      adviser = await createUser("Adviser", "ADVISER");
      panelist = await createUser("Panelist", "PANELIST");
      dean = await createUser("Dean", "DEAN");
      coordinator = await createUser("Coordinator", "RESEARCH_COORDINATOR");
      oversight = await createUser("Oversight", "DEAN");
      outsider = await createUser("Outsider", "PANELIST", other.id);
      const project = await tx.researchProject.create({ data: {
        title: marker, status: "APPROVED", collegeId: own.id, programId: program.id,
        researchTypeId: researchType.id, academicYearId: year.id, createdBy: student.id,
      } });
      projectId = project.id;
      fixture.projectIds.push(project.id);
      await tx.researchMember.createMany({ data: [
        { researchId: projectId, userId: student.id, projectRole: "LEADER" },
        { researchId: projectId, userId: peer.id, projectRole: "MEMBER" },
        { researchId: projectId, userId: adviser.id, projectRole: "ADVISER" },
      ] });
      for (const group of ["Second", "Third"]) {
        const researcher = await createUser(group, "RESEARCHER");
        const { id: researchId } = await tx.researchProject.create({ data: {
          title: `${marker} ${group}`, status: "APPROVED", collegeId: own.id, programId: program.id,
          researchTypeId: researchType.id, academicYearId: year.id, createdBy: researcher.id,
        } });
        fixture.projectIds.push(researchId);
        otherGroups.push({ researchId, researcher });
        await tx.researchMember.createMany({ data: [
          { researchId, userId: researcher.id, projectRole: "LEADER" },
          { researchId, userId: adviser.id, projectRole: "ADVISER" },
          { researchId, userId: coordinator.id, projectRole: "COORDINATOR" },
        ] });
      }
    });
    await startApi();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    let index = 0;
    vi.spyOn(googleCalendarService, "createMeetConsultation").mockImplementation(async (eventId, options) => ({
      eventId,
      meetingUrl: options.manualMeetingUrl || `https://meet.google.com/${links[index++]}`,
    }));
    vi.spyOn(googleCalendarService, "updateConsultation").mockResolvedValue(undefined);
    vi.spyOn(googleCalendarService, "cancelConsultation").mockResolvedValue(undefined);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (server?.listening) await stopApi();
    await cleanupIntegrationFixture(prisma, fixture);
    await prisma.$disconnect();
  });

  it("shares a pending student request with the exact adviser, then issues one invitation on concurrent approval", async () => {
    const payload = schedule("Chapter review", [], { adviserId: adviser.id, description: "Review the methodology" });
    const result = await add(student, payload);
    expect(result.status).toBe(201);
    const id = result.data.consultation.id;
    expect(result.data.consultation).toMatchObject({ status: "requested", meetingUrl: "" });
    expect((await add(student, payload)).data.consultation.id).toBe(id);
    expect(googleCalendarService.createMeetConsultation).not.toHaveBeenCalled();
    expect((await request(adviser)).data.consultations).toContainEqual(expect.objectContaining({ id, status: "requested", canManage: true }));
    expect((await approve(peer, id)).status).toBe(403);
    expect((await approve(coordinator, id)).status).toBe(403);
    expect(await prisma.notification.count({ where: { entityId: id, recipientId: adviser.id, title: "New consultation request" } })).toBe(1);
    const [first, second] = await Promise.all([approve(adviser, id), approve(adviser, id)]);
    expect(first.status).toBe(200);
    expect(second.data.consultation.meetingUrl).toBe(first.data.consultation.meetingUrl);
    expect(googleCalendarService.createMeetConsultation).toHaveBeenCalledTimes(1);
    expect(googleCalendarService.createMeetConsultation).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      attendees: expect.arrayContaining([{ email: student.email, displayName: "Student Test" }, { email: adviser.email, displayName: "Adviser Test" }]),
    }));
    expect((await join(student, id)).data.meetingUrl).toBe(first.data.consultation.meetingUrl);
    expect((await request(student)).data.consultations).toContainEqual(expect.objectContaining({ id, meetingUrl: first.data.consultation.meetingUrl }));
    expect((await join(peer, id)).status).toBe(404);
    expect((await request(peer, `/consultations/${id}/notes`)).status).toBe(404);
  });

  it("sends the same URL to multiple faculty and students, scopes calendar and dean views, and survives reopening the API", async () => {
    const guests = [student, peer, panelist, dean, coordinator];
    const recipientPath = `/consultations/recipients?researchId=${projectId}`;
    expect((await request(adviser, `${recipientPath}&q=Panelist%20Test`)).data.recipients).toEqual([
      { id: panelist.id, name: "Panelist Test", roles: ["Panelist"] },
    ]);
    expect((await request(student, `${recipientPath}&adviser=true`)).data.recipients.map(({ id }: { id: string }) => id)).toEqual([adviser.id]);
    expect((await request(outsider, recipientPath)).status).toBe(403);
    expect((await request(adviser, "/calendar", "POST", { type: "CONSULTATION" })).status).toBe(400);
    expect((await add(adviser, schedule("Cross-college", [outsider.id]))).status).toBe(403);
    const payload = schedule("Research proposal consultation", guests.map(({ id }) => id), slot(3));
    const created = await Promise.all([add(adviser, payload), add(adviser, payload)]);
    expect(created.map(({ status }) => status)).toEqual([201, 201]);
    const { id, meetingUrl } = created[0].data.consultation;
    expect(created[1].data.consultation.id).toBe(id);
    expect(googleCalendarService.createMeetConsultation).toHaveBeenCalledTimes(1);
    const attendees = vi.mocked(googleCalendarService.createMeetConsultation).mock.calls[0][1].attendees;
    expect(attendees?.map(({ email }) => email).sort()).toEqual([adviser, ...guests].map(({ email }) => email).sort());
    expect(await prisma.notification.count({ where: { entityId: id } })).toBe(6);
    for (const [person, workspace] of [[panelist, "panelist"], [dean, "dean"], [coordinator, "coordinator"]] as const) {
      expect((await request(person, `/consultations/workspace/${workspace}`)).data.consultations)
        .toContainEqual(expect.objectContaining({ id, meetingUrl }));
    }
    expect((await request(oversight, "/consultations/workspace/dean")).data.consultations.find((row: { id: string }) => row.id === id)).not.toHaveProperty("meetingUrl");
    expect((await calendar(oversight)).data.events).not.toContainEqual(expect.objectContaining({ id: `consultation:${id}` }));
    expect((await calendar(dean)).data.events).toContainEqual(expect.objectContaining({ id: `consultation:${id}`, meetingUrl }));
    expect((await join(outsider, id)).status).toBe(404);
    await stopApi();
    await prisma.$disconnect();
    await startApi();
    expect((await request(student)).data.consultations).toContainEqual(expect.objectContaining({ id, meetingUrl }));
    expect((await join(dean, id)).data.meetingUrl).toBe(meetingUrl);
  });

  it("retains an actionable failed or pending state, then reuses the same event identity for retry", async () => {
    vi.mocked(googleCalendarService.createMeetConsultation)
      .mockRejectedValueOnce(new ConsultationCalendarError("Google Calendar is not configured."))
      .mockRejectedValueOnce(new ConsultationCalendarError("Still preparing.", true));
    const payload = schedule("Retryable consultation", [student.id], slot(4));
    const failed = await add(adviser, payload);
    expect(failed.status).toBe(502);
    expect(failed.data.consultation).toMatchObject({ status: "provisioning", conferenceState: "failed", meetingUrl: "" });
    const id = failed.data.consultation.id;
    expect((await join(student, id)).status).toBe(409);
    expect((await add(adviser, schedule("Conflicts while preparing", [student.id], slot(4)))).status).toBe(409);
    expect(googleCalendarService.createMeetConsultation).toHaveBeenCalledTimes(1);
    const pending = await add(adviser, payload);
    expect(pending.status).toBe(202);
    expect(pending.data.consultation).toMatchObject({ id, status: "provisioning", conferenceState: "pending", meetingUrl: "" });
    const ready = await approve(adviser, id);
    expect(ready.status).toBe(200);
    expect(ready.data.consultation).toMatchObject({ id, status: "scheduled", conferenceState: "google_verified" });
    expect(new Set(vi.mocked(googleCalendarService.createMeetConsultation).mock.calls.map(([eventId]) => eventId)).size).toBe(1);
  });

  it("updates the existing event and participant access, then queues a failed cancellation for retry", async () => {
    const original = slot(5);
    const result = await add(adviser, schedule("Reschedule and cancel", [student.id, panelist.id], original));
    const { id, revision, meetingUrl } = result.data.consultation;
    const before = await prisma.consultation.findUniqueOrThrow({ where: { id } });
    const edited = {
      action: "reschedule", revision, participantIds: [student.id, dean.id],
      scheduledStart: "2098-07-13T02:00:00.000Z", scheduledEnd: "2098-07-13T03:00:00.000Z",
    };
    vi.mocked(googleCalendarService.updateConsultation).mockRejectedValueOnce(new ConsultationCalendarError("Temporary failure"));
    const queued = await change(adviser, id, edited);
    expect(queued.status).toBe(202);
    expect(queued.data.consultation).toMatchObject({ id, meetingUrl, scheduledStart: original.scheduledStart, calendarUpdatePending: true });
    expect((await add(adviser, schedule("Current slot still reserved", [student.id], original))).status).toBe(409);
    expect((await add(adviser, schedule("New slot already reserved", [student.id], {
      scheduledStart: edited.scheduledStart, scheduledEnd: edited.scheduledEnd,
    }))).status).toBe(409);
    const changed = await syncConsultationUpdate(id);
    expect(changed).toMatchObject({ id, meetingUrl, scheduledStart: new Date(edited.scheduledStart), pendingCalendarUpdate: null });
    expect((await change(adviser, id, edited)).status).toBe(200);
    expect(googleCalendarService.updateConsultation).toHaveBeenCalledTimes(2);
    expect((await add(adviser, schedule("Previous slot released", [student.id], original))).status).toBe(201);
    expect(googleCalendarService.updateConsultation).toHaveBeenCalledWith(before.googleEventId, expect.objectContaining({
      scheduledStart: new Date(edited.scheduledStart), attendees: expect.arrayContaining([expect.objectContaining({ email: dean.email })]),
    }), meetingUrl);
    expect((await join(panelist, id)).status).toBe(404);
    expect((await join(dean, id)).data.meetingUrl).toBe(meetingUrl);
    expect((await calendar(student)).data.events).toContainEqual(expect.objectContaining({ id: `consultation:${id}`, startsAt: edited.scheduledStart }));
    vi.mocked(googleCalendarService.cancelConsultation).mockRejectedValueOnce(new ConsultationCalendarError("Temporary failure"));
    expect((await change(adviser, id, { action: "cancel" })).status).toBe(202);
    expect((await request(student)).data.consultations).toContainEqual(expect.objectContaining({ id, status: "cancelled", meetingUrl: "" }));
    expect((await calendar(student)).data.events).not.toContainEqual(expect.objectContaining({ id: `consultation:${id}` }));
    expect((await prisma.consultation.findUniqueOrThrow({ where: { id } })).calendarCancellationPending).toBe(true);
    await syncConsultationCancellation(id);
    expect(googleCalendarService.cancelConsultation).toHaveBeenLastCalledWith(before.googleEventId);
    expect((await prisma.consultation.findUniqueOrThrow({ where: { id } })).calendarCancellationPending).toBe(false);
    expect(await prisma.notification.count({ where: { entityId: id, recipientId: student.id, title: "Consultation cancelled" } })).toBe(1);
  });

  it("isolates concurrent instant sessions from each other and a scheduled meeting", async () => {
    const scheduled = (await add(adviser, schedule("Scheduled", [student.id], slot(6)))).data.consultation;
    const one = schedule("Student instant", [adviser.id], { instant: true });
    const two = schedule("Adviser instant", [student.id], { instant: true });
    const [studentMeeting, adviserMeeting] = await Promise.all([add(student, one), add(adviser, two)]);
    expect(studentMeeting.status).toBe(201);
    expect(adviserMeeting.status).toBe(201);
    const first = studentMeeting.data.consultation, second = adviserMeeting.data.consultation;
    expect(new Set([first.meetingUrl, second.meetingUrl, scheduled.meetingUrl]).size).toBe(3);
    expect((await add(student, one)).data.consultation.id).toBe(first.id);
    expect((await join(adviser, first.id)).data.meetingUrl).toBe(first.meetingUrl);
    expect((await join(student, second.id)).data.meetingUrl).toBe(second.meetingUrl);
    expect((await join(student, scheduled.id)).data.meetingUrl).toBe(scheduled.meetingUrl);
    expect((await change(adviser, first.id, { action: "complete" })).status).toBe(403);
    expect((await change(student, first.id, { action: "complete" })).data.consultation.status).toBe("completed");
    expect((await join(adviser, first.id)).status).toBe(409);
    expect(googleCalendarService.cancelConsultation).not.toHaveBeenCalled();
  });

  it("supports decline and rescheduled approval and labels manually supplied rooms separately", async () => {
    const rejected = await add(student, schedule("Decline", [], { adviserId: adviser.id }));
    expect((await change(adviser, rejected.data.consultation.id, { action: "decline" })).data.consultation.status).toBe("declined");
    const proposed = await add(student, schedule("Change approval time", [], { adviserId: adviser.id }));
    const range = { scheduledStart: "2098-07-13T04:00:00.000Z", scheduledEnd: "2098-07-13T05:00:00.000Z" };
    expect((await approve(adviser, proposed.data.consultation.id, range)).data.consultation.scheduledStart).toBe(range.scheduledStart);
    const manual = "https://meet.google.com/xyz-abcd-efg";
    const existing = await add(adviser, schedule("Existing room", [student.id], { ...slot(7), meetingUrl: manual }));
    expect(existing.data.consultation).toMatchObject({ meetingUrl: manual, conferenceState: "manual" });
    expect((await add(adviser, schedule("Invalid room", [student.id], { meetingUrl: "https://meet.google.com/new" }))).status).toBe(400);
  });

  it("keeps simultaneous requests from three groups separate and books one adviser slot", async () => {
    const groups = [{ researchId: projectId, researcher: student }, ...otherGroups];
    const submitted = await Promise.all(groups.map(({ researchId, researcher }) =>
      add(researcher, schedule("Same adviser time", [], { ...slot(10), researchId, adviserId: adviser.id })),
    ));
    expect(submitted.map(({ status }) => status)).toEqual([201, 201, 201]);
    expect(submitted.every(({ data }) => data.consultation.status === "requested")).toBe(true);
    expect(googleCalendarService.createMeetConsultation).not.toHaveBeenCalled();

    const ids = submitted.map(({ data }) => data.consultation.id);
    const approved = await Promise.all(ids.map((id) => approve(adviser, id)));
    expect(approved.map(({ status }) => status).sort()).toEqual([200, 409, 409]);
    expect(googleCalendarService.createMeetConsultation).toHaveBeenCalledTimes(1);
    const denied = ids.filter((_, index) => approved[index].status === 409);
    expect(await prisma.consultation.count({ where: { id: { in: denied }, status: "REQUESTED" } })).toBe(2);

    const next = await approve(adviser, denied[0], slot(11));
    expect(next.status).toBe(200);
    expect(next.data.consultation.scheduledStart).toBe(slot(10).scheduledEnd);
    const overlap = await change(adviser, next.data.consultation.id, {
      action: "reschedule", scheduledStart: "2098-07-12T10:30:00.000Z", scheduledEnd: slot(11).scheduledEnd,
    });
    expect(overlap.status).toBe(409);
    expect(googleCalendarService.updateConsultation).not.toHaveBeenCalled();

    const { researchId, researcher } = otherGroups[0];
    const direct = { ...slot(10), researchId };
    expect((await add(coordinator, schedule("Already booked adviser", [researcher.id, adviser.id], direct))).status).toBe(409);
    expect((await add(coordinator, schedule("Separate appointment", [researcher.id], direct))).status).toBe(201);
  });

  it("queues Calendar cancellation when the assigned adviser withdraws", async () => {
    const result = await add(adviser, schedule("Adviser withdrawal", [student.id, dean.id], slot(8)));
    expect(result.status).toBe(201);
    const id = result.data.consultation.id;
    const withdrawal = await request(adviser, `/research/${projectId}/adviser-withdrawal`, "POST", {
      reason: "WORKLOAD_AVAILABILITY", note: "No longer available this term.",
    });
    expect(withdrawal.status).toBe(200);
    const saved = await prisma.consultation.findUniqueOrThrow({ where: { id } });
    expect(saved).toMatchObject({ status: "CANCELLED", calendarCancellationPending: true });
    expect((await join(student, id)).status).toBe(409);
    expect(await prisma.notification.count({
      where: { entityId: id, recipientId: dean.id, title: "Consultation cancelled after adviser withdrawal" },
    })).toBe(1);
    await syncConsultationCancellation(id);
    expect(googleCalendarService.cancelConsultation).toHaveBeenCalledWith(saved.googleEventId);
  });
});
