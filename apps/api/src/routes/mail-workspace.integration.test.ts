import crypto from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

interface FixtureUser {
  id: string;
  token: string;
  email: string;
}

interface MailFixture {
  adviser: FixtureUser;
  student: FixtureUser;
  bccStudent: FixtureUser;
  panelist: FixtureUser;
  coordinator: FixtureUser;
  rpo: FixtureUser;
  reb: FixtureUser;
  vpaa: FixtureUser;
  systemAdmin: FixtureUser;
  outsider: FixtureUser;
  userIds: string[];
  collegeIds: string[];
  programIds: string[];
  academicYearIds: string[];
  researchTypeIds: string[];
  projectIds: string[];
}

async function closeServer(server: http.Server | undefined) {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function json(response: Response) {
  return response.json() as Promise<any>;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

databaseDescribe("Formal mail workspace authorization and persistence", () => {
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  const scope = createIntegrationFixtureScope(
    `mail-workspace-${suffix.toLowerCase()}`,
  );
  let server: http.Server | undefined;
  let baseUrl = "";
  let fixture: MailFixture;
  let threadId = "";
  let draftId = "";
  let attachmentId = "";

  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    scope.databaseVerified = true;

    fixture = await prisma.$transaction(async (tx) => {
      const roleNames = [
        "ADVISER",
        "RESEARCHER",
        "RESEARCH_COORDINATOR",
        "PANELIST",
        "RPO",
        "REB",
        "VPAA",
        "SYSTEM_ADMIN",
      ] as const;
      for (const name of roleNames) {
        await tx.role.upsert({
          where: { name },
          update: {},
          create: { name, description: `Mail integration ${name}` },
        });
      }
      const roles = await tx.role.findMany({
        where: { name: { in: [...roleNames] } },
      });
      const roleId = new Map(roles.map((role) => [role.name, role.id]));

      const college = await tx.college.create({
        data: {
          code: `MW${suffix}`,
          name: `Mail Workspace College ${suffix}`,
        },
      });
      const outsiderCollege = await tx.college.create({
        data: {
          code: `MO${suffix}`,
          name: `Mail Outsider College ${suffix}`,
        },
      });
      const program = await tx.program.create({
        data: {
          collegeId: college.id,
          code: `MW${suffix}`,
          name: `Mail Workspace Program ${suffix}`,
        },
      });
      const outsiderProgram = await tx.program.create({
        data: {
          collegeId: outsiderCollege.id,
          code: `MO${suffix}`,
          name: `Mail Outsider Program ${suffix}`,
        },
      });
      const academicYear = await tx.academicYear.create({
        data: {
          name: `MW-${suffix}`,
          startDate: new Date("2097-06-01T00:00:00.000Z"),
          endDate: new Date("2098-05-31T00:00:00.000Z"),
        },
      });

      const createUser = async (
        name: string,
        role: (typeof roleNames)[number],
        otherCollege = false,
      ): Promise<FixtureUser> => {
        const user = await tx.user.create({
          data: {
            universityId: `MW-${suffix}-${name.toUpperCase()}`,
            email: `mail-workspace-${suffix.toLowerCase()}-${name}@integration.test`,
            firstName: name,
            lastName: "Mail Fixture",
            status: "ACTIVE",
            collegeId: otherCollege ? outsiderCollege.id : college.id,
            programId: otherCollege ? outsiderProgram.id : program.id,
          },
        });
        await tx.userRole.create({
          data: { userId: user.id, roleId: roleId.get(role)! },
        });
        return { id: user.id, token: generateToken(user.id), email: user.email };
      };

      const adviser = await createUser("adviser", "ADVISER");
      const student = await createUser("student", "RESEARCHER");
      const bccStudent = await createUser("bcc-student", "RESEARCHER");
      const panelist = await createUser("panelist", "PANELIST");
      const coordinator = await createUser(
        "coordinator",
        "RESEARCH_COORDINATOR",
      );
      const rpo = await createUser("rpo", "RPO");
      const reb = await createUser("reb", "REB");
      const vpaa = await createUser("vpaa", "VPAA");
      const systemAdmin = await createUser("system-admin", "SYSTEM_ADMIN");
      const outsider = await createUser("outsider", "RESEARCHER", true);
      const researchType = await tx.researchType.create({
        data: {
          programId: program.id,
          name: `Mail Workspace Research ${suffix}`,
          code: `MW-${suffix}`,
        },
      });
      const project = await tx.researchProject.create({
        data: {
          researchTypeId: researchType.id,
          programId: program.id,
          collegeId: college.id,
          academicYearId: academicYear.id,
          title: `Mail Workspace Project ${suffix}`,
          groupName: `Mail-${suffix}`,
          participationMode: "GROUP",
          status: "UNDER_REVIEW",
          createdBy: student.id,
        },
      });
      await tx.researchMember.createMany({
        data: [
          { researchId: project.id, userId: student.id, projectRole: "LEADER" },
          { researchId: project.id, userId: bccStudent.id, projectRole: "MEMBER" },
          { researchId: project.id, userId: adviser.id, projectRole: "ADVISER" },
          { researchId: project.id, userId: panelist.id, projectRole: "PANELIST" },
        ],
      });

      return {
        adviser,
        student,
        bccStudent,
        panelist,
        coordinator,
        rpo,
        reb,
        vpaa,
        systemAdmin,
        outsider,
        userIds: [
          adviser.id,
          student.id,
          bccStudent.id,
          panelist.id,
          coordinator.id,
          rpo.id,
          reb.id,
          vpaa.id,
          systemAdmin.id,
          outsider.id,
        ],
        collegeIds: [college.id, outsiderCollege.id],
        programIds: [program.id, outsiderProgram.id],
        academicYearIds: [academicYear.id],
        researchTypeIds: [researchType.id],
        projectIds: [project.id],
      };
    });
    scope.userIds.push(...fixture.userIds);
    scope.collegeIds.push(...fixture.collegeIds);
    scope.programIds.push(...fixture.programIds);
    scope.academicYearIds.push(...fixture.academicYearIds);
    scope.researchTypeIds.push(...fixture.researchTypeIds);
    scope.projectIds.push(...fixture.projectIds);

    await new Promise<void>((resolve, reject) => {
      const candidate = http.createServer(app);
      server = candidate;
      candidate.once("error", reject);
      candidate.listen(0, () => {
        const address = candidate.address();
        if (!address || typeof address === "string") {
          reject(new Error("Mail integration server did not expose a TCP port."));
          return;
        }
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    const errors: unknown[] = [];
    try {
      await closeServer(server);
    } catch (error) {
      errors.push(error);
    }
    try {
      const threads = await prisma.mailThread.findMany({
        where: { createdById: { in: fixture?.userIds || [] } },
        select: { id: true },
      });
      const threadIds = threads.map((thread) => thread.id);
      await prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({
          where: {
            OR: [
              { recipientId: { in: fixture?.userIds || [] } },
              ...(threadIds.length
                ? [{ entityType: "MailThread", entityId: { in: threadIds } }]
                : []),
            ],
          },
        });
        await tx.mailThread.deleteMany({ where: { id: { in: threadIds } } });
      });
      await cleanupIntegrationFixture(prisma, scope);
    } catch (error) {
      errors.push(error);
    }
    try {
      await prisma.$disconnect();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) {
      throw new AggregateError(errors, "Mail integration teardown failed.");
    }
  });

  it("limits recipient discovery to real academic relationships", async () => {
    const response = await fetch(`${baseUrl}/api/mail/contacts`, {
      headers: auth(fixture.student.token),
    });
    expect(response.status).toBe(200);
    const data = await json(response);
    const ids = new Set(data.contacts.map((contact: any) => contact.id));
    expect(ids.has(fixture.adviser.id)).toBe(true);
    expect(ids.has(fixture.bccStudent.id)).toBe(true);
    expect(ids.has(fixture.panelist.id)).toBe(true);
    expect(ids.has(fixture.coordinator.id)).toBe(true);
    expect(ids.has(fixture.rpo.id)).toBe(true);
    expect(ids.has(fixture.reb.id)).toBe(true);
    expect(ids.has(fixture.vpaa.id)).toBe(true);
    expect(ids.has(fixture.systemAdmin.id)).toBe(true);
    expect(ids.has(fixture.outsider.id)).toBe(false);

    const rpoResponse = await fetch(`${baseUrl}/api/mail/contacts`, {
      headers: auth(fixture.rpo.token),
    });
    expect(rpoResponse.status).toBe(200);
    const rpoIds = new Set(
      (await json(rpoResponse)).contacts.map((contact: any) => contact.id),
    );
    expect(rpoIds.has(fixture.student.id)).toBe(true);
    expect(rpoIds.has(fixture.vpaa.id)).toBe(true);
    expect(rpoIds.has(fixture.systemAdmin.id)).toBe(true);
    expect(rpoIds.has(fixture.outsider.id)).toBe(false);

    const rebResponse = await fetch(`${baseUrl}/api/mail/contacts`, {
      headers: auth(fixture.reb.token),
    });
    expect(rebResponse.status).toBe(200);
    const rebIds = new Set(
      (await json(rebResponse)).contacts.map((contact: any) => contact.id),
    );
    expect(rebIds.has(fixture.student.id)).toBe(true);
    expect(rebIds.has(fixture.outsider.id)).toBe(false);

    const coordinatorResponse = await fetch(`${baseUrl}/api/mail/contacts`, {
      headers: auth(fixture.coordinator.token),
    });
    expect(coordinatorResponse.status).toBe(200);
    const coordinatorIds = new Set(
      (await json(coordinatorResponse)).contacts.map(
        (contact: any) => contact.id,
      ),
    );
    expect(coordinatorIds.has(fixture.adviser.id)).toBe(true);
    expect(coordinatorIds.has(fixture.outsider.id)).toBe(false);

    const vpaaResponse = await fetch(`${baseUrl}/api/mail/contacts`, {
      headers: auth(fixture.vpaa.token),
    });
    expect(vpaaResponse.status).toBe(200);
    const vpaaIds = new Set(
      (await json(vpaaResponse)).contacts.map((contact: any) => contact.id),
    );
    expect(vpaaIds.has(fixture.outsider.id)).toBe(true);

    const systemAdminResponse = await fetch(`${baseUrl}/api/mail/contacts`, {
      headers: auth(fixture.systemAdmin.token),
    });
    expect(systemAdminResponse.status).toBe(200);
    const systemAdminIds = new Set(
      (await json(systemAdminResponse)).contacts.map(
        (contact: any) => contact.id,
      ),
    );
    expect(systemAdminIds.has(fixture.outsider.id)).toBe(true);
  });

  it("keeps a multi-recipient draft private, editable, and safely sendable", async () => {
    const draftForm = new FormData();
    draftForm.append("toIds", JSON.stringify([fixture.student.id]));
    draftForm.append("ccIds", JSON.stringify([fixture.panelist.id]));
    draftForm.append("bccIds", JSON.stringify([fixture.bccStudent.id]));
    draftForm.append("subject", "Formal review coordination");
    draftForm.append("body", "Initial private draft");
    draftForm.append("action", "draft");
    draftForm.append(
      "files",
      new Blob(["academic attachment"], { type: "text/plain" }),
      "notes.txt",
    );
    const create = await fetch(`${baseUrl}/api/mail/messages`, {
      method: "POST",
      headers: auth(fixture.adviser.token),
      body: draftForm,
    });
    expect(create.status).toBe(201);
    const created = await json(create);
    threadId = created.thread.id;
    draftId = created.message.id;

    const hiddenFromRecipient = await fetch(
      `${baseUrl}/api/mail/threads/${threadId}`,
      { headers: auth(fixture.student.token) },
    );
    expect(hiddenFromRecipient.status).toBe(404);

    const draftStateHiddenFromRecipient = await fetch(
      `${baseUrl}/api/mail/threads/${threadId}/state`,
      {
        method: "PATCH",
        headers: {
          ...auth(fixture.student.token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "mark-read" }),
      },
    );
    expect(draftStateHiddenFromRecipient.status).toBe(404);

    const drafts = await fetch(`${baseUrl}/api/mail/threads?folder=drafts`, {
      headers: auth(fixture.adviser.token),
    });
    const draftList = await json(drafts);
    expect(draftList.threads).toHaveLength(1);
    attachmentId = draftList.threads[0].messages[0].attachments[0].id;
    expect(
      draftList.threads[0].participants.some(
        (participant: any) =>
          participant.userId === fixture.bccStudent.id &&
          participant.recipientType === "BCC",
      ),
    ).toBe(true);

    const updateForm = new FormData();
    updateForm.append("toIds", JSON.stringify([fixture.student.id]));
    updateForm.append("ccIds", JSON.stringify([fixture.panelist.id]));
    updateForm.append("bccIds", JSON.stringify([fixture.bccStudent.id]));
    updateForm.append("subject", "Formal review coordination");
    updateForm.append("body", "**Updated** formal review message");
    updateForm.append("keepAttachmentIds", JSON.stringify([attachmentId]));
    const update = await fetch(`${baseUrl}/api/mail/drafts/${draftId}`, {
      method: "PUT",
      headers: auth(fixture.adviser.token),
      body: updateForm,
    });
    expect(update.status).toBe(200);

    const send = await fetch(`${baseUrl}/api/mail/drafts/${draftId}/send`, {
      method: "POST",
      headers: auth(fixture.adviser.token),
    });
    expect(send.status).toBe(200);
  });

  it("protects Bcc identity, thread access, attachment access, and unread state", async () => {
    const inbox = await fetch(`${baseUrl}/api/mail/threads?folder=inbox`, {
      headers: auth(fixture.student.token),
    });
    expect(inbox.status).toBe(200);
    const inboxData = await json(inbox);
    expect(inboxData.counts.unread).toBe(1);
    expect(inboxData.threads[0].unread).toBe(true);
    expect(
      inboxData.threads[0].participants.some(
        (participant: any) => participant.userId === fixture.bccStudent.id,
      ),
    ).toBe(false);

    const bccSearch = await fetch(
      `${baseUrl}/api/mail/threads?folder=inbox&query=${encodeURIComponent(fixture.bccStudent.email)}`,
      { headers: auth(fixture.student.token) },
    );
    expect((await json(bccSearch)).threads).toHaveLength(0);

    const senderSearch = await fetch(
      `${baseUrl}/api/mail/threads?folder=sent&query=${encodeURIComponent(fixture.bccStudent.email)}`,
      { headers: auth(fixture.adviser.token) },
    );
    expect((await json(senderSearch)).threads).toHaveLength(1);

    const open = await fetch(`${baseUrl}/api/mail/threads/${threadId}`, {
      headers: auth(fixture.student.token),
    });
    expect(open.status).toBe(200);
    const opened = await json(open);
    expect(opened.thread.unread).toBe(false);
    expect(opened.thread.messages[0].body).toContain("Updated");

    const afterRead = await fetch(`${baseUrl}/api/mail/threads?folder=inbox`, {
      headers: auth(fixture.student.token),
    });
    expect((await json(afterRead)).counts.unread).toBe(0);

    const authorizedAttachment = await fetch(
      `${baseUrl}/api/mail/attachments/${attachmentId}`,
      { headers: auth(fixture.student.token) },
    );
    expect(authorizedAttachment.status).toBe(200);
    expect(await authorizedAttachment.text()).toBe("academic attachment");

    const outsiderThread = await fetch(`${baseUrl}/api/mail/threads/${threadId}`, {
      headers: auth(fixture.outsider.token),
    });
    expect(outsiderThread.status).toBe(404);
    const outsiderAttachment = await fetch(
      `${baseUrl}/api/mail/attachments/${attachmentId}`,
      { headers: auth(fixture.outsider.token) },
    );
    expect(outsiderAttachment.status).toBe(404);
  });

  it("updates reply unread state and keeps archive, trash, and restore user-specific", async () => {
    const reply = new FormData();
    reply.append("body", "Student revision response");
    const replyResponse = await fetch(
      `${baseUrl}/api/mail/threads/${threadId}/reply`,
      {
        method: "POST",
        headers: auth(fixture.student.token),
        body: reply,
      },
    );
    expect(replyResponse.status).toBe(201);

    const sent = await fetch(`${baseUrl}/api/mail/threads?folder=sent`, {
      headers: auth(fixture.adviser.token),
    });
    const sentData = await json(sent);
    expect(sentData.threads[0].unread).toBe(true);

    const archive = await fetch(`${baseUrl}/api/mail/threads/${threadId}/state`, {
      method: "PATCH",
      headers: {
        ...auth(fixture.adviser.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "archive" }),
    });
    expect(archive.status).toBe(200);
    const archived = await fetch(`${baseUrl}/api/mail/threads?folder=archive`, {
      headers: auth(fixture.adviser.token),
    });
    expect((await json(archived)).threads[0].id).toBe(threadId);

    const trash = await fetch(`${baseUrl}/api/mail/threads/${threadId}/state`, {
      method: "PATCH",
      headers: {
        ...auth(fixture.adviser.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "trash" }),
    });
    expect(trash.status).toBe(200);
    const trashed = await fetch(`${baseUrl}/api/mail/threads?folder=trash`, {
      headers: auth(fixture.adviser.token),
    });
    expect((await json(trashed)).threads[0].id).toBe(threadId);

    const restore = await fetch(`${baseUrl}/api/mail/threads/${threadId}/state`, {
      method: "PATCH",
      headers: {
        ...auth(fixture.adviser.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "restore" }),
    });
    expect(restore.status).toBe(200);
    const restored = await fetch(`${baseUrl}/api/mail/threads?folder=sent`, {
      headers: auth(fixture.adviser.token),
    });
    expect((await json(restored)).threads[0].id).toBe(threadId);
  });

  it("rejects unauthorized recipients and executable attachments", async () => {
    const unauthorized = new FormData();
    unauthorized.append("toIds", JSON.stringify([fixture.outsider.id]));
    unauthorized.append("subject", "Unauthorized contact");
    unauthorized.append("body", "This must be denied");
    const recipientResponse = await fetch(`${baseUrl}/api/mail/messages`, {
      method: "POST",
      headers: auth(fixture.student.token),
      body: unauthorized,
    });
    expect(recipientResponse.status).toBe(403);

    const executable = new FormData();
    executable.append("toIds", JSON.stringify([fixture.student.id]));
    executable.append("subject", "Unsafe attachment");
    executable.append("body", "This file must be denied");
    executable.append(
      "files",
      new Blob(["not an executable"], { type: "application/octet-stream" }),
      "malware.exe",
    );
    const attachmentResponse = await fetch(`${baseUrl}/api/mail/messages`, {
      method: "POST",
      headers: auth(fixture.adviser.token),
      body: executable,
    });
    expect(attachmentResponse.status).toBe(400);
  });
});
