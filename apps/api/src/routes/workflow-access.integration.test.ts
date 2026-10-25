import crypto from "node:crypto";
import http from "node:http";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
import {
  assertIsolatedIntegrationDatabase,
  createIntegrationFixtureScope,
  cleanupIntegrationFixture,
} from "../test/database-integration.js";
const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe(
  "Workflow approval and account-bound Advisio inbox invitations",
  () => {
    const marker = `workflow-access-${crypto.randomUUID().slice(0, 8)}`;
    const fixture = createIntegrationFixtureScope(marker);
    let server: http.Server,
      base: string,
      owner: string,
      other: string,
      one: string,
      two: string,
      three: string,
      outsider: string,
      typeId: string,
      version = 0;
    async function api(
      user: string,
      path: string,
      method = "GET",
      body?: unknown,
    ) {
      const r = await fetch(`${base}/api/workflows${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${generateToken(user)}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    }
    async function workflow() {
      const w = await prisma.workflow.create({
        data: {
          name: marker,
          researchTypeId: typeId,
          createdBy: owner,
          version: ++version,
          status: "PUBLISHED",
          inviteCode: crypto.randomBytes(5).toString("hex").toUpperCase(),
          inviteExpiresAt: new Date(Date.now() + 86400000),
        },
      });
      fixture.workflowIds.push(w.id);
      return w;
    }
    beforeAll(async () => {
      await assertIsolatedIntegrationDatabase(prisma);
      fixture.databaseVerified = true;
      const c = await prisma.college.create({
        data: { code: marker.slice(-8), name: marker },
      });
      fixture.collegeIds.push(c.id);
      const p = await prisma.program.create({
        data: { code: marker.slice(-8), name: marker, collegeId: c.id },
      });
      fixture.programIds.push(p.id);
      const op = await prisma.program.create({
        data: {
          code: `O-${marker.slice(-8)}`,
          name: `${marker}-other`,
          collegeId: c.id,
        },
      });
      fixture.programIds.push(op.id);
      async function user(
        name: string,
        roleName: "RESEARCHER" | "RESEARCH_COORDINATOR",
        programId = p.id,
      ) {
        const role = await prisma.role.upsert({
          where: { name: roleName },
          update: {},
          create: { name: roleName },
        });
        const u = await prisma.user.create({
          data: {
            universityId: `${marker}-${name}`,
            email: `${marker}-${name}@isolated.test`,
            firstName: name,
            lastName: marker,
            status: "ACTIVE",
            collegeId: c.id,
            programId,
            roles: { create: { roleId: role.id } },
          },
        });
        fixture.userIds.push(u.id);
        return u.id;
      }
      owner = await user("owner", "RESEARCH_COORDINATOR");
      other = await user("other", "RESEARCH_COORDINATOR");
      one = await user("one", "RESEARCHER");
      two = await user("two", "RESEARCHER");
      three = await user("three", "RESEARCHER");
      outsider = await user("outside", "RESEARCHER", op.id);
      const t = await prisma.researchType.create({
        data: { code: marker.slice(-8), name: marker, programId: p.id },
      });
      fixture.researchTypeIds.push(t.id);
      typeId = t.id;
      server = http.createServer(app);
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      base = `http://127.0.0.1:${(server.address() as any).port}`;
    }, 30000);
    afterAll(async () => {
      if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      if (fixture.databaseVerified) {
        await prisma.mailThread.deleteMany({
          where: { createdById: { in: fixture.userIds } },
        });
        await cleanupIntegrationFixture(prisma, fixture);
      }
    }, 30000);
    it("deduplicates concurrent join requests and withholds protected workflow data", async () => {
      const w = await workflow();
      const preview = await api(one, `/invitation/${w.inviteCode}`);
      expect(preview.status).toBe(200);
      expect(preview.body.invitation).not.toHaveProperty("stages");
      expect(preview.body.invitation).not.toHaveProperty("description");
      const results = await Promise.all([
        api(one, `/join/${w.inviteCode}`, "POST", {}),
        api(one, `/join/${w.inviteCode}`, "POST", {}),
      ]);
      expect(results.map((r) => r.status)).toEqual([202, 202]);
      expect(results[0].body.entry.id).toBe(results[1].body.entry.id);
      expect(
        await prisma.workflowEnrollment.count({ where: { workflowId: w.id } }),
      ).toBe(0);
      expect(
        (await api(one, "/enrollments/me")).body.enrollments.some(
          (e: any) => e.workflowId === w.id,
        ),
      ).toBe(false);
      expect(
        (await api(one, "/")).body.workflows.some((e: any) => e.id === w.id),
      ).toBe(false);
      expect((await api(one, `/${w.id}/resources`)).status).toBe(404);
      const id = results[0].body.entry.id;
      expect(
        (
          await api(other, `/access/${id}/decision`, "POST", {
            action: "approve",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await api(one, `/access/${id}/decision`, "POST", {
            action: "approve",
          })
        ).status,
      ).toBe(403);
      const approvals = await Promise.all([
        api(owner, `/access/${id}/decision`, "POST", { action: "approve" }),
        api(owner, `/access/${id}/decision`, "POST", { action: "approve" }),
      ]);
      expect(approvals.map((r) => r.status)).toEqual([200, 200]);
      expect(
        await prisma.workflowEnrollment.count({ where: { workflowId: w.id } }),
      ).toBe(1);
    });
    it("delivers multiple private inbox invitations and allows only the invited account to accept", async () => {
      const w = await workflow();
      const pending = await api(one, `/join/${w.inviteCode}`, "POST", {});
      const result = await api(owner, `/${w.id}/access/invitations`, "POST", {
        userIds: [one, two, one, outsider],
      });
      expect(result.body.results.map((r: any) => r.status)).toEqual([
        "Sent",
        "Sent",
        "Failed",
      ]);
      const entries = await prisma.workflowAccessEntry.findMany({
        where: { workflowId: w.id, kind: "INVITATION" },
      });
      expect(entries).toHaveLength(2);
      const invitation = entries.find((e) => e.userId === one)!;
      const inbox = await fetch(
        `${base}/api/mail/threads/${invitation.mailThreadId}`,
        { headers: { Authorization: `Bearer ${generateToken(one)}` } },
      );
      expect(inbox.status).toBe(200);
      const thread = (await inbox.json()).thread;
      expect(thread.workflowInvitation.id).toBe(invitation.id);
      expect(thread.participants.map((p: any) => p.user.id).sort()).toEqual(
        [owner, one].sort(),
      );
      const wrong = await fetch(
        `${base}/api/mail/threads/${invitation.mailThreadId}`,
        { headers: { Authorization: `Bearer ${generateToken(two)}` } },
      );
      expect(wrong.status).toBe(404);
      expect(
        (
          await api(two, `/access/${invitation.id}/decision`, "POST", {
            action: "accept",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await api(one, `/access/${invitation.id}/decision`, "POST", {
            action: "accept",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await prisma.workflowAccessEntry.findUniqueOrThrow({
            where: { id: pending.body.entry.id },
          })
        ).status,
      ).toBe("APPROVED");
      expect(
        await prisma.workflowEnrollment.count({ where: { workflowId: w.id } }),
      ).toBe(1);
      const again = await api(owner, `/${w.id}/access/invitations`, "POST", {
        userIds: [one, two],
      });
      expect(again.body.results.map((r: any) => r.status)).toEqual([
        "Already a member",
        "Already invited",
      ]);
      const i2 = entries.find((e) => e.userId === two)!;
      expect(
        (
          await api(two, `/access/${i2.id}/decision`, "POST", {
            action: "decline",
          })
        ).status,
      ).toBe(200);
      expect(
        await prisma.workflowEnrollment.count({
          where: { workflowId: w.id, userId: two },
        }),
      ).toBe(0);
    });
    it("retains revocation until a professor explicitly sends a new invitation", async () => {
      const w = await workflow();
      await api(owner, `/${w.id}/access/invitations`, "POST", {
        userIds: [three],
      });
      const entry = await prisma.workflowAccessEntry.findFirstOrThrow({
        where: { workflowId: w.id, userId: three },
      });
      const enrollment = await prisma.workflowEnrollment.create({
        data: { workflowId: w.id, userId: three },
      });
      expect(
        (
          await api(owner, `/enrollments/${enrollment.id}`, "DELETE", {
            reason: "Test removal",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await api(three, `/access/${entry.id}/decision`, "POST", {
            action: "accept",
          })
        ).status,
      ).toBe(409);
      expect(
        (await api(three, `/join/${w.inviteCode}`, "POST", {})).status,
      ).toBe(403);
      expect((await api(three, `/invitation/${w.inviteCode}`)).status).toBe(
        403,
      );
      expect(
        (
          await prisma.workflowEnrollment.findUniqueOrThrow({
            where: { id: enrollment.id },
          })
        ).status,
      ).toBe("REVOKED");
      await api(owner, `/${w.id}/access/invitations`, "POST", {
        userIds: [three],
      });
      expect(
        (
          await api(three, `/access/${entry.id}/decision`, "POST", {
            action: "accept",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await prisma.workflowEnrollment.findUniqueOrThrow({
            where: { id: enrollment.id },
          })
        ).status,
      ).toBe("ACTIVE");
    });
    it("declines and cancels join requests without enrolling, and rechecks approval eligibility", async () => {
      const w = await workflow();
      const r = await api(one, `/join/${w.inviteCode}`, "POST", {});
      expect(
        (
          await api(owner, `/access/${r.body.entry.id}/decision`, "POST", {
            action: "decline",
          })
        ).status,
      ).toBe(200);
      expect((await api(one, `/join/${w.inviteCode}`, "POST", {})).status).toBe(
        409,
      );
      const c = await api(two, `/join/${w.inviteCode}`, "POST", {});
      expect(
        (
          await api(two, `/access/${c.body.entry.id}/decision`, "POST", {
            action: "cancel",
          })
        ).status,
      ).toBe(200);
      const r3 = await api(three, `/join/${w.inviteCode}`, "POST", {});
      await prisma.user.update({
        where: { id: three },
        data: { status: "SUSPENDED" },
      });
      expect(
        (
          await api(owner, `/access/${r3.body.entry.id}/decision`, "POST", {
            action: "approve",
          })
        ).status,
      ).toBe(403);
      await prisma.user.update({
        where: { id: three },
        data: { status: "ACTIVE" },
      });
      expect(
        await prisma.workflowEnrollment.count({ where: { workflowId: w.id } }),
      ).toBe(0);
    });
    it("rejects expired, disabled, and rotated codes while keeping submitted requests reviewable", async () => {
      const w = await workflow();
      expect(
        (await api(outsider, `/join/${w.inviteCode}`, "POST", {})).status,
      ).toBe(403);
      const pending = await api(one, `/join/${w.inviteCode}`, "POST", {});
      expect((await api(other, `/${w.id}/invitation`, "POST", {})).status).toBe(
        403,
      );
      const rotated = await api(owner, `/${w.id}/invitation`, "POST", {});
      expect((await api(two, `/join/${w.inviteCode}`, "POST", {})).status).toBe(
        404,
      );
      await api(owner, `/${w.id}/invitation`, "DELETE");
      expect(
        (
          await api(
            two,
            `/join/${rotated.body.invitation.inviteCode}`,
            "POST",
            {},
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await api(
            owner,
            `/access/${pending.body.entry.id}/decision`,
            "POST",
            { action: "approve" },
          )
        ).status,
      ).toBe(200);
      const expired = await workflow();
      await prisma.workflow.update({
        where: { id: expired.id },
        data: { inviteExpiresAt: new Date(0) },
      });
      expect(
        (await api(two, `/join/${expired.inviteCode}`, "POST", {})).status,
      ).toBe(404);
    });
    it("revokes direct invitations and rate-limits reminders", async () => {
      const w = await workflow();
      await api(owner, `/${w.id}/access/invitations`, "POST", {
        userIds: [two],
      });
      const e = await prisma.workflowAccessEntry.findFirstOrThrow({
        where: { workflowId: w.id, userId: two },
      });
      expect(
        (await api(other, `/access/${e.id}/resend`, "POST", {})).status,
      ).toBe(403);
      expect(
        (await api(owner, `/access/${e.id}/resend`, "POST", {})).status,
      ).toBe(429);
      await prisma.mailMessage.updateMany({
        where: { threadId: e.mailThreadId! },
        data: { createdAt: new Date(Date.now() - 120000) },
      });
      expect(
        (await api(owner, `/access/${e.id}/resend`, "POST", {})).status,
      ).toBe(200);
      expect(
        (
          await api(owner, `/access/${e.id}/decision`, "POST", {
            action: "revoke",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await api(two, `/access/${e.id}/decision`, "POST", {
            action: "accept",
          })
        ).status,
      ).toBe(409);
    });
  },
);
