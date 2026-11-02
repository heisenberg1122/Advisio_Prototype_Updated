import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { assertIsolatedIntegrationDatabase } from "../test/database-integration.js";
import http from "node:http";
import bcrypt from "bcryptjs";
import app from "../app.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe("audit append-only storage", () => {
  const actorId = randomUUID(),
    entityId = randomUUID();
  const role = `audit_test_${randomUUID().replaceAll("-", "")}`;
  let eventId: string;
  let verified = false,
    roleCreated = false;
  const authActorId = randomUUID();
  let server: http.Server, baseUrl: string;
  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    verified = true;
    await prisma.$executeRawUnsafe(`CREATE ROLE ${role} NOLOGIN`);
    roleCreated = true;
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT ON audit_logs TO ${role}`,
    );
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    if (!verified) return;
    if (server)
      await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.auditLog.deleteMany({ where: { entityId } });
    await prisma.auditLog.deleteMany({ where: { userId: authActorId } });
    await prisma.user.deleteMany({ where: { id: authActorId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    if (roleCreated) {
      await prisma.$executeRawUnsafe(`DROP OWNED BY ${role}`);
      await prisma.$executeRawUnsafe(`DROP ROLE ${role}`);
    }
  });
  it("preserves the historical actor after account deletion", async () => {
    await prisma.user.create({
      data: {
        id: actorId,
        universityId: `audit-${actorId}`,
        email: `${actorId}@audit.example`,
        firstName: "Audit",
        lastName: "Fixture",
      },
    });
    const event = await prisma.auditLog.create({
      data: {
        userId: actorId,
        entityId,
        entityType: "USER_ACCOUNT",
        action: "UPDATE",
        newValues: { status: "ACTIVE", passwordHash: "must-not-persist" },
      },
    });
    eventId = event.id;
    await prisma.user.delete({ where: { id: actorId } });
    expect(
      await prisma.auditLog.findUnique({ where: { id: eventId } }),
    ).toMatchObject({
      userId: actorId,
      actorReference: actorId,
      newValues: { status: "ACTIVE" },
    });
  });
  it("allows INSERT and SELECT for a restricted runtime role", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      const event = await tx.auditLog.create({
        data: { entityId, entityType: "AuditFixture", action: "CREATE" },
      });
      expect(
        await tx.auditLog.findUnique({ where: { id: event.id } }),
      ).not.toBeNull();
    });
  });
  it("rejects UPDATE, DELETE and TRUNCATE even if accidentally granted", async () => {
    await prisma.$executeRawUnsafe(
      `GRANT UPDATE, DELETE, TRUNCATE ON audit_logs TO ${role}`,
    );
    for (const sql of [
      `UPDATE audit_logs SET outcome='SUCCESS' WHERE id='${eventId}'`,
      `DELETE FROM audit_logs WHERE id='${eventId}'`,
      "TRUNCATE audit_logs",
    ]) {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
          await tx.$executeRawUnsafe(sql);
        }),
      ).rejects.toThrow("append-only");
    }
    expect(
      await prisma.auditLog.findUnique({ where: { id: eventId } }),
    ).not.toBeNull();
  });
  it("rolls back the business operation when its audit write fails", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: actorId,
            universityId: `audit-${actorId}`,
            email: `${actorId}@audit.example`,
            firstName: "Audit",
            lastName: "Rollback",
          },
        });
        await tx.auditLog.create({
          data: {
            entityId,
            entityType: "AuditFixture",
            action: "UPDATE",
            newValues: { large: Array(40).fill("a".repeat(2000)) },
          },
        });
      }),
    ).rejects.toThrow("16 KiB");
    expect(await prisma.user.findUnique({ where: { id: actorId } })).toBeNull();
  });
  it("deduplicates a retry without rewriting prior evidence", async () => {
    const data = {
      entityId,
      entityType: "SecuritySummary",
      action: "UPDATE" as const,
      operationKey: `test:${entityId}`,
    };
    await prisma.auditLog.createMany({ data: [data], skipDuplicates: true });
    await prisma.auditLog.createMany({ data: [data], skipDuplicates: true });
    expect(
      await prisma.auditLog.count({
        where: { operationKey: data.operationKey },
      }),
    ).toBe(1);
  });
  it("records real login/logout handoffs and denies the admin viewer to a non-admin", async () => {
    await prisma.user.create({
      data: {
        id: authActorId,
        universityId: `audit-${authActorId}`,
        email: `${authActorId}@audit.example`,
        firstName: "Audit",
        lastName: "Authentication",
        status: "ACTIVE",
        passwordHash: await bcrypt.hash("AuditTestPassword123!", 4),
      },
    });
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${authActorId}@audit.example`,
        password: "AuditTestPassword123!",
      }),
    });
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as { token: string };
    expect(
      await prisma.auditLog.findFirst({
        where: { userId: authActorId, eventType: "LOGIN_SUCCEEDED" },
      }),
    ).toMatchObject({
      action: "LOGIN",
      category: "SECURITY",
      outcome: "SUCCESS",
      actorReference: authActorId,
    });
    const unauthorized = await fetch(`${baseUrl}/api/admin/audit`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(unauthorized.status).toBe(403);
    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logout.status).toBe(204);
    expect(
      await prisma.auditLog.count({
        where: { userId: authActorId, eventType: "LOGOUT_REQUESTED" },
      }),
    ).toBe(1);
  });
});
